import { GUIDES, GUIDE_CATEGORIES, getGuide } from "@/lib/guides";
import { OG_SIZE, guideOgImage } from "../og-card";

export const alt = "Nura guide";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export default async function GuideOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  const kicker = GUIDE_CATEGORIES.find((c) => c.id === guide?.category)?.label ?? "Guides";
  return guideOgImage(guide?.question ?? "Nura guides", kicker);
}
