import { generateObject } from "ai";
import { z } from "zod";
import { getVisionModel } from "./models";

export async function processImageWithVision(
  imageUrl: string
): Promise<{ textContent: string; tokensUsed: number }> {
  try {
    const model = getVisionModel();
    const { object, usage } = await generateObject({
      model: model as any,
      schema: z.object({ markdown: z.string() }),
      messages: [
        {
          role: "system",
          content: "Extract all text comprehensively, preserving formatting.",
        },
        { role: "user", content: [{ type: "image", image: imageUrl }] },
      ],
    });
    const textContent = object.markdown || "";
    const tokensUsed = usage?.totalTokens ?? Math.ceil(textContent.length / 4);
    return { textContent, tokensUsed };
  } catch (error) {
    console.error("Error processing image with vision model:", error);
    return {
      textContent: `Error processing image: ${
        error instanceof Error ? error.message : String(error)
      }`,
      tokensUsed: 0,
    };
  }
}
