"""
title: Vertex AI Gateway Filter
description: Enhances MCP tool responses with progress indicators and citation formatting.
             Defines ZERO tools — only enhances UX for MCP tool calls routed through LiteLLM.
author: Vertex AI Brain
version: 1.0.0
license: MIT
"""

import json
import re
from typing import Optional
from pydantic import BaseModel, Field


class Filter:
    """
    OpenWebUI Filter that wraps MCP tool-call responses from the Vertex AI
    Gateway with progress spinners (EventEmitter) and citation formatting.

    Install via: Workspace > Functions > Add Filter (paste this file).

    This filter defines NO tools. All tools are provided by the gateway's
    MCP endpoint, discovered automatically by LiteLLM.
    """

    # Fix 7: Valves using proper Pydantic BaseModel with Field descriptors.
    # Renders in OpenWebUI admin UI per docs.openwebui.com/features/extensibility/plugin/development/valves
    class Valves(BaseModel):
        GATEWAY_URL: str = Field(
            default="http://gateway:8085",
            description="Vertex AI Gateway base URL (used for citation link rewriting)",
        )
        CITATION_FORMAT: str = Field(
            default="markdown",
            description="Citation output format: 'markdown' or 'inline'",
        )
        SHOW_CONFIDENCE: bool = Field(
            default=True,
            description="Append grounding confidence scores to citations",
        )
        ENABLE_STATUS_UPDATES: bool = Field(
            default=True,
            description="Show progress spinners during tool calls via EventEmitter",
        )
        CONFIDENCE_THRESHOLD: float = Field(
            default=0.0,
            ge=0.0,
            le=1.0,
            description="Minimum grounding confidence to display (0.0 = show all)",
        )

    def __init__(self):
        self.valves = self.Valves()

    # -----------------------------------------------------------------
    # inlet: fires before the LLM call
    # -----------------------------------------------------------------
    async def inlet(
        self,
        body: dict,
        __user__: Optional[dict] = None,
        __event_emitter__=None,
    ) -> dict:
        """
        Fix 8: EventEmitter support — detect pending tool calls and fire
        a 'Searching…' status spinner so the user sees immediate feedback.
        """
        if not __event_emitter__ or not self.valves.ENABLE_STATUS_UPDATES:
            return body

        messages = body.get("messages", [])
        if not messages:
            return body

        last_msg = messages[-1].get("content", "")
        if not isinstance(last_msg, str):
            return body

        # Heuristic: if the LLM is about to use a tool (detected by prior
        # assistant message with tool_calls), show a spinner.  On the first
        # user message we have no way to know, so we skip.
        for msg in reversed(messages):
            if msg.get("role") == "assistant":
                tool_calls = msg.get("tool_calls") or []
                if tool_calls:
                    tool_names = [
                        tc.get("function", {}).get("name", "tool")
                        for tc in tool_calls
                        if isinstance(tc, dict)
                    ]
                    label = ", ".join(tool_names[:3])
                    await __event_emitter__(
                        {
                            "type": "status",
                            "data": {
                                "description": f"Calling: {label}…",
                                "done": False,
                            },
                        }
                    )
                break

        return body

    # -----------------------------------------------------------------
    # outlet: fires after the LLM response
    # -----------------------------------------------------------------
    async def outlet(
        self,
        body: dict,
        __user__: Optional[dict] = None,
        __event_emitter__=None,
    ) -> dict:
        """
        Post-processes assistant responses:
        1. Clears any in-flight status spinners.
        2. Reformats grounding citations from raw JSON into readable markdown.
        """
        messages = body.get("messages", [])
        if not messages:
            return body

        # Clear spinner
        if __event_emitter__ and self.valves.ENABLE_STATUS_UPDATES:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {"description": "", "done": True},
                }
            )

        # Find last assistant message
        last_assistant = None
        for msg in reversed(messages):
            if msg.get("role") == "assistant":
                last_assistant = msg
                break

        if not last_assistant:
            return body

        content = last_assistant.get("content", "")
        if not isinstance(content, str):
            return body

        # Attempt to extract and reformat gateway JSON responses embedded
        # in tool results (LiteLLM passes tool results through as content).
        content = self._format_citations_in_content(content)
        last_assistant["content"] = content

        return body

    # -----------------------------------------------------------------
    # Citation formatting helpers
    # -----------------------------------------------------------------
    def _format_citations_in_content(self, content: str) -> str:
        """
        Scan for JSON-shaped gateway responses in the content and reformat
        citations into human-readable markdown footnotes.
        """
        # Try to find JSON blocks that look like GatewayResponse
        json_pattern = re.compile(r"\{[^{}]*\"citations\"\s*:\s*\[.*?\][^{}]*\}", re.DOTALL)

        for match in json_pattern.finditer(content):
            try:
                data = json.loads(match.group())
            except (json.JSONDecodeError, ValueError):
                continue

            citations = data.get("citations")
            if not isinstance(citations, list) or not citations:
                continue

            answer = data.get("answer", "")
            grounding = data.get("grounding_support", [])

            formatted = self._build_citation_block(answer, citations, grounding)
            if formatted:
                content = content.replace(match.group(), formatted)

        return content

    def _build_citation_block(
        self,
        answer: str,
        citations: list,
        grounding_support: list,
    ) -> str:
        """Build a markdown citation block from gateway response data."""
        if not answer:
            return ""

        lines = [answer, ""]

        # Build confidence map by index
        confidence_map: dict[int, float] = {}
        for gs in grounding_support:
            if not isinstance(gs, dict):
                continue
            score = gs.get("score", 0.0)
            if isinstance(score, (int, float)):
                # Map by position (best effort)
                idx = len(confidence_map) + 1
                confidence_map[idx] = float(score)

        # Format citations
        has_citations = False
        for cit in citations:
            if not isinstance(cit, dict):
                continue

            uri = cit.get("uri", "")
            title = cit.get("title", "Source")
            index = cit.get("index", 0)
            score = confidence_map.get(index)

            # Skip below threshold
            if score is not None and score < self.valves.CONFIDENCE_THRESHOLD:
                continue

            if self.valves.CITATION_FORMAT == "markdown":
                line = f"[{index}] [{title}]({uri})" if uri else f"[{index}] {title}"
                if self.valves.SHOW_CONFIDENCE and score is not None:
                    line += f" ({score:.0%})"
                lines.append(line)
                has_citations = True
            else:
                # Inline format
                if uri:
                    lines.append(f"Source: {title} — {uri}")
                else:
                    lines.append(f"Source: {title}")
                has_citations = True

        if not has_citations:
            return answer

        return "\n".join(lines)
