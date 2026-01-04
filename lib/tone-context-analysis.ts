/**
 * Tone Context Analysis - Analyze how tone changes with different contexts
 * 
 * This module analyzes how a user's tone varies based on:
 * - Topic/subject matter
 * - Post length
 * - Engagement level
 * - Content type (personal, technical, manifesto, etc.)
 * - Presence of links/citations
 * - Emotional context
 */

import { SuccessfulPost } from "./voice-analysis";

export interface ToneContext {
  context: string;
  posts: SuccessfulPost[];
  toneCharacteristics: string[];
  languagePatterns: string[];
  examples: string[];
}

export interface ToneVariationAnalysis {
  overallPattern: string;
  contexts: ToneContext[];
  transitions: string[];
  recommendations: string[];
}

/**
 * Categorize posts by context
 */
function categorizeByContext(posts: SuccessfulPost[]): Map<string, SuccessfulPost[]> {
  const categories = new Map<string, SuccessfulPost[]>();

  posts.forEach((post) => {
    const text = post.text.toLowerCase();
    let category = "general";

    // Personal narrative / vulnerability
    if (
      text.includes("i almost") ||
      text.includes("my dream") ||
      text.includes("i'm") ||
      text.includes("i was") ||
      text.includes("grieving") ||
      text.includes("personal")
    ) {
      category = "personal_narrative";
    }
    // Technical / academic
    else if (
      text.includes("doi:") ||
      text.includes("research") ||
      text.includes("methodology") ||
      text.includes("psychology") ||
      text.includes("data") ||
      text.includes("genetic") ||
      text.match(/\b(hci|api|doi)\b/i)
    ) {
      category = "technical_academic";
    }
    // Manifesto / declarative
    else if (
      text.length < 100 &&
      (text.includes("don't") ||
        text.includes("build") ||
        text.includes("truth") ||
        text.includes("should") ||
        text.match(/^[A-Z]/))
    ) {
      category = "manifesto_declarative";
    }
    // Spiritual / philosophical
    else if (
      text.includes("god") ||
      text.includes("divine") ||
      text.includes("aura") ||
      text.includes("horizon") ||
      text.includes("righteous") ||
      text.includes("spiritual") ||
      text.includes("chaos")
    ) {
      category = "spiritual_philosophical";
    }
    // Cultural commentary
    else if (
      text.includes("storytelling") ||
      text.includes("characters") ||
      text.includes("poke") ||
      text.includes("connections") ||
      text.includes("vaporware")
    ) {
      category = "cultural_commentary";
    }
    // Ironic / humorous
    else if (
      text.includes("promotion") ||
      text.includes("stregnth") ||
      text.includes("#based") ||
      text.includes("working hard")
    ) {
      category = "ironic_humorous";
    }
    // Art / creative
    else if (
      text.includes("art") ||
      text.includes("collection") ||
      text.includes("bridge") ||
      text.includes("shards")
    ) {
      category = "art_creative";
    }

    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(post);
  });

  return categories;
}

/**
 * Analyze tone characteristics for a set of posts
 */
function analyzeToneCharacteristics(posts: SuccessfulPost[]): {
  toneCharacteristics: string[];
  languagePatterns: string[];
} {
  const allText = posts.map((p) => p.text).join(" ");
  const characteristics: string[] = [];
  const patterns: string[] = [];

  // Check for lowercase "i"
  if (allText.match(/\bi\b/g) && !allText.match(/\bI\b/g)) {
    characteristics.push("Consistent lowercase 'i' - intentional authenticity");
    patterns.push("lowercase_personal_pronoun");
  }

  // Check for declarative statements
  const declarativeCount = posts.filter((p) => {
    const text = p.text;
    return (
      text.match(/^[A-Z][^.!?]*\.$/) ||
      text.match(/^[a-z][^.!?]*\.$/) ||
      (text.length < 100 && !text.includes("?"))
    );
  }).length;
  if (declarativeCount > posts.length * 0.5) {
    characteristics.push("High frequency of declarative statements");
    patterns.push("declarative_structure");
  }

  // Check for technical terms
  if (allText.match(/\b(doi|api|hci|methodology|data|genetic)\b/i)) {
    characteristics.push("Technical/academic vocabulary");
    patterns.push("technical_terminology");
  }

  // Check for spiritual terms
  if (allText.match(/\b(god|divine|aura|horizon|righteous|spiritual|chaos)\b/i)) {
    characteristics.push("Spiritual/philosophical language");
    patterns.push("spiritual_terminology");
  }

  // Check for personal pronouns
  const personalPronouns = (allText.match(/\b(my|i|me|we|our)\b/gi) || []).length;
  if (personalPronouns > posts.length * 2) {
    characteristics.push("High use of personal pronouns - personal voice");
    patterns.push("personal_pronouns");
  }

  // Check for imperatives
  if (allText.match(/\b(don't|should|must|get|build)\b/gi)) {
    characteristics.push("Imperative/instructional language");
    patterns.push("imperative_commands");
  }

  // Check for vulnerability markers
  if (allText.match(/\b(almost|grieving|struggle|gave up|dead)\b/i)) {
    characteristics.push("Vulnerability and personal struggle");
    patterns.push("vulnerability_markers");
  }

  // Check for irony markers
  if (allText.match(/\b(promotion|stregnth|working hard|#based)\b/i)) {
    characteristics.push("Ironic/cultural juxtaposition");
    patterns.push("ironic_tone");
  }

  // Check post length patterns
  const avgLength = posts.reduce((sum, p) => sum + p.text.length, 0) / posts.length;
  if (avgLength < 50) {
    characteristics.push("Brevity - concise, impactful statements");
    patterns.push("brevity");
  } else if (avgLength > 200) {
    characteristics.push("Extended narrative - detailed storytelling");
    patterns.push("extended_narrative");
  }

  return { toneCharacteristics: characteristics, languagePatterns: patterns };
}

/**
 * Analyze tone transitions between contexts
 */
function analyzeTransitions(contexts: ToneContext[]): string[] {
  const transitions: string[] = [];

  // Check for spiritual-technical transitions
  const hasSpiritual = contexts.some((c) => c.context === "spiritual_philosophical");
  const hasTechnical = contexts.some((c) => c.context === "technical_academic");
  if (hasSpiritual && hasTechnical) {
    transitions.push(
      "Seamless blending of spiritual and technical language - signature voice element"
    );
  }

  // Check for personal-technical transitions
  const hasPersonal = contexts.some((c) => c.context === "personal_narrative");
  if (hasPersonal && hasTechnical) {
    transitions.push(
      "Personal experience framed as technical/academic data - unique positioning"
    );
  }

  // Check for manifesto to narrative
  const hasManifesto = contexts.some((c) => c.context === "manifesto_declarative");
  if (hasManifesto && hasPersonal) {
    transitions.push(
      "Alternates between declarative wisdom and vulnerable narrative - creates depth"
    );
  }

  // Check for ironic to serious
  const hasIronic = contexts.some((c) => c.context === "ironic_humorous");
  if (hasIronic && (hasSpiritual || hasTechnical)) {
    transitions.push(
      "Uses irony for engagement but maintains serious core message - strategic tone shifting"
    );
  }

  return transitions;
}

/**
 * Generate recommendations based on tone variation
 */
function generateRecommendations(contexts: ToneContext[], transitions: string[]): string[] {
  const recommendations: string[] = [];

  // Check for context diversity
  if (contexts.length >= 4) {
    recommendations.push(
      "High context diversity - maintain this range to avoid voice fatigue"
    );
  } else {
    recommendations.push(
      "Consider expanding context range - voice may benefit from more variation"
    );
  }

  // Check for consistent elements
  const allPatterns = contexts.flatMap((c) => c.languagePatterns);
  const uniquePatterns = new Set(allPatterns);
  if (uniquePatterns.size < 3) {
    recommendations.push(
      "Limited language pattern variation - consider introducing new rhetorical devices"
    );
  }

  // Engagement-based recommendations
  const highEngagementContexts = contexts.filter((c) =>
    c.posts.some((p) => (p as any).totalEngagement > 50)
  );
  if (highEngagementContexts.length > 0) {
    recommendations.push(
      `High engagement contexts: ${highEngagementContexts.map((c) => c.context).join(", ")} - amplify these`
    );
  }

  // Transition recommendations
  if (transitions.length > 0) {
    recommendations.push(
      "Tone transitions are a strength - maintain the ability to shift between registers"
    );
  }

  return recommendations;
}

/**
 * Main function: Analyze tone variation by context
 */
export function analyzeToneByContext(
  posts: SuccessfulPost[]
): ToneVariationAnalysis {
  // Categorize posts by context
  const contextMap = categorizeByContext(posts);
  const contexts: ToneContext[] = [];

  contextMap.forEach((postsInContext, contextName) => {
    const { toneCharacteristics, languagePatterns } = analyzeToneCharacteristics(
      postsInContext
    );
    const examples = postsInContext
      .slice(0, 2)
      .map((p) => p.text.substring(0, 150) + (p.text.length > 150 ? "..." : ""));

    contexts.push({
      context: contextName,
      posts: postsInContext,
      toneCharacteristics,
      languagePatterns,
      examples,
    });
  });

  // Analyze transitions
  const transitions = analyzeTransitions(contexts);

  // Determine overall pattern
  let overallPattern = "Consistent voice with contextual adaptation";
  if (contexts.length >= 5) {
    overallPattern = "Highly adaptive voice - tone shifts significantly by context";
  } else if (contexts.length <= 2) {
    overallPattern = "Focused voice - tone remains relatively consistent across contexts";
  }

  // Generate recommendations
  const recommendations = generateRecommendations(contexts, transitions);

  return {
    overallPattern,
    contexts,
    transitions,
    recommendations,
  };
}
