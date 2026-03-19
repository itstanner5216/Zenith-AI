import { NextResponse, NextRequest } from "next/server";
import {  generateText } from "ai";
import { getVisionModel } from "@/lib/models";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";

export const maxDuration = 300; // Vision models can be slower for complex images

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { userId } = await handleAuthorizationV2(request);
    const model = getVisionModel();

    const defaultInstruction = "Extract all text from the image comprehensively, preserving formatting. Focus only on extracting readable text, not describing visual elements.";
    const responseInstruction = "Respond with only the extracted text.";

    const promptText = payload.instructions?.trim()
      ? `${defaultInstruction} ${payload.instructions} ${responseInstruction}`
      : `${defaultInstruction} ${responseInstruction}`;
    console.log("promptText", promptText);


    const response = await generateText({
      model: model as any,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image", image: payload.image }
        ],
      }],
    });
    return NextResponse.json({ text: response.text });
  } catch (error) {
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
  }
}