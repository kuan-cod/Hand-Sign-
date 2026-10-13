import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // Main gesture translation endpoint (single frame or multi-frame sequence)
  app.post("/api/translate-gesture", async (req, res) => {
    try {
      const { image, frames, mimeType = "image/jpeg", contextHistory = [] } = req.body;

      if (!image && (!frames || frames.length === 0)) {
        res.status(400).json({ error: "No image or frames provided" });
        return;
      }

      const ai = getGeminiClient();

      const contentsParts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
      > = [];

      if (frames && Array.isArray(frames) && frames.length > 0) {
        frames.forEach((frameData: string, idx: number) => {
          const cleanBase64 = frameData.replace(/^data:image\/[a-z]+;base64,/, "");
          contentsParts.push({
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          });
          contentsParts.push({
            text: `[Frame ${idx + 1} of ${frames.length} in sequence]`
          });
        });
      } else if (image) {
        const cleanBase64 = image.replace(/^data:image\/[a-z]+;base64,/, "");
        contentsParts.push({
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        });
      }

      const promptText = `
You are an expert American Sign Language (ASL), universal hand gesture, and body language translator.
Analyze the provided camera frame(s) carefully.

Task:
1. Detect whether one or both human hands are visible and making an intentional hand sign, ASL letter (A-Z), ASL number (0-9), ASL word/phrase (e.g., Hello, Thank You, Please, Yes, No, I Love You, Help, Friend, Eat, Water, etc.), or universal gesture (Thumbs Up, Peace/V-sign, OK sign, Rock On, Wave, Fist Bump, Crossed Fingers, Heart Hands, Stop/Halt, etc.).
2. If multiple frames are provided, analyze the motion/trajectory of the hand across time to recognize dynamic signs (e.g. wave for hello, chin-to-forward for thank you, circular chest rub for please).
3. If no hand or gesture is present, or hands are relaxed/blurry without an intentional sign, mark detected = false.
4. If a gesture is detected, provide the primary translated word/phrase, category, confidence (0-100), detailed hand posture description (fingers extended/curled, palm orientation, orientation), meaning, alternative interpretations, and suggested next words.

Recent translated context from user: ${contextHistory.length > 0 ? contextHistory.slice(-5).join(" ") : "None yet"}
`;

      contentsParts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: { parts: contentsParts },
        config: {
          systemInstruction:
            "You are a precise, respectful real-time Sign Language and Hand Gesture Translator. Always output structured JSON strictly matching the requested schema.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detected: {
                type: Type.BOOLEAN,
                description: "True if an intentional hand sign or gesture is detected, false otherwise",
              },
              word: {
                type: Type.STRING,
                description: "The translated word, letter, number, or gesture name (e.g., 'Hello', 'A', 'Thank you', 'Thumbs Up')",
              },
              category: {
                type: Type.STRING,
                description: "One of: 'asl_alphabet', 'asl_word', 'asl_number', 'universal_gesture', 'two_handed', 'unknown'",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence percentage from 0 to 100",
              },
              meaning: {
                type: Type.STRING,
                description: "Brief explanation of what the gesture conveys or means",
              },
              handDetails: {
                type: Type.STRING,
                description: "Observation of fingers, palm orientation, and hand shape",
              },
              alternatives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Other possible interpretations if sign is ambiguous",
              },
              nextWordSuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "1-3 likely words to follow in a sentence",
              },
            },
            required: ["detected", "word", "category", "confidence", "meaning", "handDetails"],
          },
        },
      });

      const rawText = response.text || "{}";
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (error: any) {
      console.error("Error in translate-gesture:", error);
      res.status(500).json({
        error: error?.message || "Failed to translate gesture",
        detected: false,
      });
    }
  });

  // Practice check endpoint
  app.post("/api/practice-check", async (req, res) => {
    try {
      const { image, targetSign, targetCategory = "asl" } = req.body;

      if (!image || !targetSign) {
        res.status(400).json({ error: "Missing image or targetSign" });
        return;
      }

      const cleanBase64 = image.replace(/^data:image\/[a-z]+;base64,/, "");
      const ai = getGeminiClient();

      const prompt = `
The user is practicing the following hand sign / gesture:
Target Sign: "${targetSign}" (Category: ${targetCategory})

Inspect the user's hand pose in the image.
1. Determine how accurately the user's hand matches the target sign: "${targetSign}".
2. Score accuracy from 0 to 100.
3. Determine if it is a match (score >= 70).
4. Provide specific, encouraging feedback and coaching tips (e.g. "Tuck your thumb against your palm", "Keep your index finger higher", "Great job! Perfect finger positioning!").
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction:
            "You are an encouraging ASL and gesture coach. Analyze the user's hand posture and provide feedback.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isMatch: {
                type: Type.BOOLEAN,
                description: "Whether the sign is sufficiently accurate to be recognized as the target",
              },
              score: {
                type: Type.NUMBER,
                description: "Accuracy percentage from 0 to 100",
              },
              detectedAs: {
                type: Type.STRING,
                description: "What sign the hand actually looks most like",
              },
              feedback: {
                type: Type.STRING,
                description: "Constructive advice on finger placement, angle, or thumb position",
              },
              tips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Bullet points for perfecting the gesture",
              },
            },
            required: ["isMatch", "score", "detectedAs", "feedback"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (error: any) {
      console.error("Error in practice-check:", error);
      res.status(500).json({
        error: error?.message || "Failed to check sign practice",
        isMatch: false,
        score: 0,
      });
    }
  });

  // Convert raw sign words / ASL gloss into fluent natural English sentence
  app.post("/api/asl-to-english", async (req, res) => {
    try {
      const { words } = req.body;

      if (!words || !Array.isArray(words) || words.length === 0) {
        res.status(400).json({ error: "Words array is required" });
        return;
      }

      const ai = getGeminiClient();
      const prompt = `
Convert this sequence of translated hand signs / ASL words into a natural, grammatically correct English sentence.
Signs/Words received: ${JSON.stringify(words)}

Example:
["ME", "STORE", "GO"] -> "I am going to the store."
["YOU", "HELP", "ME", "PLEASE"] -> "Could you please help me?"
["HELLO", "FRIEND", "HOW", "YOU"] -> "Hello friend, how are you?"
["THUMBS_UP", "THANK_YOU"] -> "Everything is good, thank you!"
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an ASL grammar converter. Transform sign language gloss/tokens into fluent, everyday English sentences.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fluentSentence: {
                type: Type.STRING,
                description: "The polished natural English sentence",
              },
              tone: {
                type: Type.STRING,
                description: "The apparent tone (e.g. friendly, questioning, urgent, casual)",
              },
            },
            required: ["fluentSentence"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (error: any) {
      console.error("Error in asl-to-english:", error);
      res.status(500).json({
        fluentSentence: (req.body.words || []).join(" "),
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
