// This is an AI-powered collusion detection system for a French Domino Scoreboard application.
//
// - detectCollusion - Analyzes historical game data to identify statistically improbable score patterns indicative of collusion.
// - DetectCollusionInput - Defines the structure for input data, including game records.
// - DetectCollusionOutput - Specifies the structure for output data, providing a collusion assessment and rationale.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema for the collusion detection flow.
const DetectCollusionInputSchema = z.object({
  gameRecords: z.array(
    z.object({
      playerScores: z.array(z.number()).describe('Scores of each player in the game.'),
      roundNumber: z.number().describe('The round number of the scores.'),
    })
  ).describe('Historical game data containing player scores for each round.'),
});
export type DetectCollusionInput = z.infer<typeof DetectCollusionInputSchema>;

// Output schema for the collusion detection flow.
const DetectCollusionOutputSchema = z.object({
  collusionDetected: z.boolean().describe('Indicates whether collusion is suspected.'),
  rationale: z.string().describe('Explanation of why collusion is suspected or not.'),
});
export type DetectCollusionOutput = z.infer<typeof DetectCollusionOutputSchema>;

export async function detectCollusion(input: DetectCollusionInput): Promise<DetectCollusionOutput> {
  return detectCollusionFlow(input);
}

const detectCollusionPrompt = ai.definePrompt({
  name: 'detectCollusionPrompt',
  input: {schema: DetectCollusionInputSchema},
  output: {schema: DetectCollusionOutputSchema},
  prompt: `You are an AI expert in game theory and statistical analysis, specializing in detecting collusion in games, especially French Dominoes.

  Analyze the provided game records to identify statistically improbable patterns that may indicate collusion between players. Consider factors such as unusually consistent score advantages, coordinated score increases or decreases, and any other patterns that deviate significantly from expected random gameplay.

  Provide a clear rationale for your assessment, explaining why collusion is suspected or not. If collusion is suspected, describe the specific patterns observed that support your conclusion. If no collusion is suspected, explain why the observed patterns appear to be within the bounds of normal gameplay.

  Game Records:
  {{#each gameRecords}}
    Round {{this.roundNumber}}:
    {{#each this.playerScores}}
      Player {{@index}}: {{this}}
    {{/each}}
  {{/each}}`,
});

const detectCollusionFlow = ai.defineFlow(
  {
    name: 'detectCollusionFlow',
    inputSchema: DetectCollusionInputSchema,
    outputSchema: DetectCollusionOutputSchema,
  },
  async input => {
    const {output} = await detectCollusionPrompt(input);
    return output!;
  }
);
