import { GoogleGenAI } from "@google/genai";
import { Habit } from "../types";

const getSystemInstruction = () => `
  You are an encouraging and analytical habit coach. 
  Analyze the user's habit data. 
  Provide 3 concise, bulleted insights or motivational tips based on their performance.
  Focus on patterns, streaks, and categories.
  Keep the tone positive but constructive.
  Do not use markdown formatting like **bold** or *italics*, just plain text.
  Max 50 words per bullet point.
`;

export const getHabitAnalysis = async (habits: Habit[]): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Prepare data summary for the AI to reduce token usage
    const summary = habits.map(h => ({
      title: h.title,
      category: h.category,
      totalCompletions: h.completedDates.length,
      lastCompleted: h.completedDates[h.completedDates.length - 1] || 'Never'
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Here is my habit data: ${JSON.stringify(summary)}. Give me 3 insights.`,
      config: {
        systemInstruction: getSystemInstruction(),
        temperature: 0.7,
      }
    });

    const text = response.text || "";
    
    // Split by new lines or bullets and filter empty strings
    const tips = text.split('\n')
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim()) // Remove bullet points
      .filter(line => line.length > 5); // Filter out empty or too short lines

    return tips.slice(0, 3); // Return top 3
  } catch (error) {
    console.error("Error fetching AI analysis:", error);
    return [
      "Keep consistent! Tracking is the first step to improvement.",
      "Try to perform your most difficult habits earlier in the day.",
      "Review your progress weekly to stay on track."
    ];
  }
};