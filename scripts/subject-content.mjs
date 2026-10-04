import { addEverydayContent } from "./everyday-content.mjs";

export const subjectReferences = [
  "https://www.justice.gov.uk/courts/procedure-rules/civil/glossary",
  "https://www.bankofengland.co.uk/glossary",
  "https://www.accaglobal.com/gb/en/study-with-acca/your-career/sectors-industries-roles/management-accountant.html",
  "https://www.accaglobal.com/gb/en/student/exam-support-resources/fundamentals-exams-study-resources/f9/technical-articles/wcm.html",
  "https://edu.rsc.org/resources/the-interactive-lab-primer-lab-apparatus/2266.article",
  "https://www.maths.ox.ac.uk/study-here/undergraduate-study/tmua/mat-livestream/precision",
  "https://dictionary.apa.org/motivation",
  "https://www.nhs.uk/nhs-services/hospitals/going-into-hospital/being-discharged-from-hospital/",
];
export function addSubjectContent(topics, targets, exercises) {
  if (!topics.some((t) => t.id === "business"))
    topics.splice(
      topics.findIndex((t) => t.id === "grammar"),
      0,
      {
        id: "business",
        title: "Wirtschaft & Unternehmen",
        description:
          "Volkswirtschaft, Controlling, Investitionen und Unternehmensabläufe verstehen.",
        icon: "BriefcaseBusiness",
        color: "lilac",
        subtopics: [],
      },
    );
  const summary = addEverydayContent(topics, targets, exercises, {
    file: "content/subject-vocabulary.txt",
    prefix: "subject",
  });
  const descriptions = {
    civic: "Behördengänge, Gerichte, Rechte und Verträge sprachlich verstehen.",
    science: "Umwelt, Mathematik, Naturwissenschaften und die Arbeit im Labor.",
    people:
      "Gefühle, Beziehungen und grundlegende psychologische Begriffe ausdrücken.",
    body: "Über Beschwerden sprechen und bei Arztbesuchen und im Krankenhaus zurechtkommen.",
  };
  for (const topic of topics)
    if (descriptions[topic.id]) topic.description = descriptions[topic.id];
  // Deliberate extra memberships share a meaning and its memory, never a copy.
  for (const [word, de, sections] of [
    ["interest rate", "Zinssatz", ["business.economy", "business.investment"]],
    ["contract", "Vertrag", ["business.processes"]],
    ["investment", "Investition", ["money.budget"]],
    ["inflation", "Inflation", ["money.budget", "society.politics"]],
    ["gross domestic product", "Bruttoinlandsprodukt", ["society.politics"]],
    ["supply chain", "Lieferkette", ["work.business"]],
    ["mental health", "psychische Gesundheit", ["body.care"]],
    ["equation", "Gleichung", ["education.study"]],
  ]) {
    const target = targets.find((t) => t.word === word && t.de === de);
    if (!target) throw new Error(`Missing shared subject meaning: ${word}`);
    for (const section of sections)
      for (const [dimension, value] of [
        ["Themen", section.split(".")[0]],
        ["Unterthemen", section],
      ]) {
        const values = (target.dimensions[dimension] ??= []);
        if (!values.includes(value)) values.push(value);
      }
  }
  return summary;
}
