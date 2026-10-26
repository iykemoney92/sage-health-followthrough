import type { GuideSource } from "./types";

/** Official pages the guides cite. Every URL was opened and read before it was linked here. */
export const SRC = {
  whatToAsk: {
    label: "NHS: What to ask your doctor or other healthcare professional",
    url: "https://www.nhs.uk/nhs-services/gps/what-to-ask-your-doctor/",
  },
  medicinesForCarers: {
    label: "NHS: Medicines tips for carers",
    url: "https://www.nhs.uk/social-care-and-support/practical-tips-if-you-care-for-someone/medicines-tips-for-carers/",
  },
  medicinesAZ: {
    label: "NHS: Medicines A to Z (each medicine's page covers what to do if you forget a dose)",
    url: "https://www.nhs.uk/medicines/",
  },
  pharmacies: {
    label: "NHS: How pharmacies can help (including help with new medicines)",
    url: "https://www.nhs.uk/nhs-services/pharmacies/how-pharmacies-can-help/",
  },
  repeatPrescription: {
    label: "NHS: How to order a repeat prescription",
    url: "https://www.nhs.uk/nhs-services/prescriptions/how-to-order-a-repeat-prescription/",
  },
  discharge: {
    label: "NHS: Being discharged from hospital",
    url: "https://www.nhs.uk/nhs-services/hospitals/going-into-hospital/being-discharged-from-hospital/",
  },
  planningToLeave: {
    label: "NHS: Planning to leave hospital",
    url: "https://www.nhs.uk/social-care-and-support/care-after-a-hospital-stay/planning-to-leave-hospital/",
  },
  surgeryRecovery: {
    label: "NHS: Having an operation, getting back to normal",
    url: "https://www.nhs.uk/tests-and-treatments/having-surgery/recovery/",
  },
  physiotherapy: {
    label: "NHS: Physiotherapy",
    url: "https://www.nhs.uk/conditions/physiotherapy/",
  },
  testResults: {
    label: "NHS: View your test results",
    url: "https://www.nhs.uk/nhs-services/gps/view-your-test-results/",
  },
  proxyAccess: {
    label: "NHS: Accessing health services for someone else (family and carer access)",
    url: "https://www.nhs.uk/nhs-services/gps/health-services-for-someone-else-family-carer-access/",
  },
  carerAssessment: {
    label: "NHS: Carer's assessments",
    url: "https://www.nhs.uk/social-care-and-support/support-and-benefits-for-carers/carer-assessments/",
  },
  respite: {
    label: "NHS: Carers' breaks and respite care",
    url: "https://www.nhs.uk/social-care-and-support/support-and-benefits-for-carers/carer-breaks-and-respite-care/",
  },
  needsAssessment: {
    label: "NHS: Getting a care needs assessment",
    url: "https://www.nhs.uk/social-care-and-support/help-from-social-services-and-charities/getting-a-needs-assessment/",
  },
  careSupportPlans: {
    label: "NHS: Care and support plans",
    url: "https://www.nhs.uk/social-care-and-support/help-from-social-services-and-charities/care-and-support-plans/",
  },
  alarms: {
    label: "NHS: Personal alarms, monitoring systems (telecare) and key safes",
    url: "https://www.nhs.uk/social-care-and-support/care-services-equipment-and-care-homes/personal-alarms-security-systems-and-keysafes/",
  },
  sleep: {
    label: "NHS Every Mind Matters: Sleep problems",
    url: "https://www.nhs.uk/every-mind-matters/mental-health-issues/sleep/",
  },
  stress: {
    label: "NHS Every Mind Matters: Dealing with stress",
    url: "https://www.nhs.uk/every-mind-matters/mental-health-issues/stress/",
  },
  nhs111: {
    label: "NHS: When to use NHS 111 online or call 111",
    url: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-use-111/",
  },
  nhs999: {
    label: "NHS: When to call 999",
    url: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/",
  },
} satisfies Record<string, GuideSource>;
