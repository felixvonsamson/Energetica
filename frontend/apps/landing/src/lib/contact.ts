export const CONTACT_EMAIL = "energetica.game@gmail.com";

function mailto(subject: string, questions: string[]): string {
    const body = questions.map((question) => `${question}: `).join("\n");
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Opens an email that already asks what we need to know to quote a workshop. */
export const workshopEnquiryHref = mailto("Energetica workshop enquiry", [
    "Preferred date",
    "Group size",
    "Who is taking part",
    "Location",
    "Language",
]);

/** Opens an email that already asks what we need to know about a course. */
export const courseEnquiryHref = mailto("Using Energetica in a course", [
    "Institution",
    "Course",
    "Semester",
    "Number of students",
]);
