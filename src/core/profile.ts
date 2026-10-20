import type { Container, ProfileInfo, Syntax } from "./model";

const XR = /urn:xeinkauf\.de:kosit:xrechnung_(\d+(?:\.\d+)*)/i;
const PEPPOL = /urn:fdc:peppol\.eu:2017:poacc:billing:(\d+\.\d+)/i;
const FX = /urn:(?:factur-x\.eu:1p0|zugferd\.de:2p0):(minimum|basicwl|basic|en16931|extended)/i;

const LEVEL_NAMES: Record<string, string> = {
  minimum: "MINIMUM",
  basicwl: "BASIC WL",
  basic: "BASIC",
  en16931: "EN 16931",
  extended: "EXTENDED",
};

/**
 * Derives a human friendly profile from the specification identifier (BT-24),
 * the business process (BT-23), the syntax and the container.
 */
export function detectProfile(
  customizationId: string | undefined,
  businessProcess: string | undefined,
  syntax: Syntax,
  container: Container,
): ProfileInfo {
  const id = customizationId ?? "";
  const base = { customizationId, businessProcess };

  const xr = XR.exec(id);
  if (xr) {
    const isExtension = /#conformant#urn:xeinkauf\.de:kosit:extension/i.test(id);
    return {
      ...base,
      family: "xrechnung",
      name: `XRechnung ${xr[1]}${isExtension ? " (Extension)" : ""}`,
      level: container === "pdf" ? "XRECHNUNG" : undefined,
      isExtension,
      isEn16931Compliant: true,
    };
  }

  const peppol = PEPPOL.exec(id);
  if (peppol) {
    return {
      ...base,
      family: "peppol",
      name: `Peppol BIS Billing ${peppol[1]}`,
      isEn16931Compliant: true,
    };
  }

  const fx = FX.exec(id);
  if (fx) {
    const key = fx[1]!.toLowerCase();
    const level = LEVEL_NAMES[key]!;
    const brand = /zugferd/i.test(id) ? "ZUGFeRD" : "ZUGFeRD / Factur-X";
    return {
      ...base,
      family: "zugferd",
      name: `${brand} ${level}`,
      level,
      isEn16931Compliant: key !== "minimum" && key !== "basicwl",
    };
  }

  if (/^urn:cen\.eu:en16931:2017/i.test(id)) {
    if (container === "pdf" || syntax === "CII") {
      return {
        ...base,
        family: "zugferd",
        name: container === "pdf" ? "ZUGFeRD / Factur-X EN 16931" : "EN 16931 (CII)",
        level: "EN 16931",
        isEn16931Compliant: true,
      };
    }
    return { ...base, family: "en16931", name: "EN 16931", isEn16931Compliant: true };
  }

  return {
    ...base,
    family: "unknown",
    name: id ? id : "Unbekanntes Profil",
    isEn16931Compliant: false,
  };
}
