import "dotenv/config";

import { analyzeWithAI } from "./services/ai.service";

async function testAI() {
  try {
    console.log("Testing TrustLens AI...");

    const result = await analyzeWithAI({
      type: "MESSAGE",
      content:
        "URGENT! Your bank account will be blocked. Share your OTP immediately to avoid suspension.",
    });

    console.log("\nAI response:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\nAI test failed:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Unknown error occurred.");
    }
  }
}

testAI();