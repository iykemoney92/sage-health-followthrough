import { OG_SIZE, guideOgImage } from "./og-card";

export const alt = "Nura guides: following through after the appointment";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function GuidesOpengraphImage() {
  return guideOgImage("Following through after the appointment", "Guides");
}
