import JSZip from "jszip";

export type HunspellOxtEntry = {
  name: string;
  aff: string;
  dic: string;
};

export type HunspellOxtCandidate = {
  name: string;
  affPath: string;
  dicPath: string;
};

const normalizeBaseName = (value: string) => value.replace(/\.(aff|dic)$/i, "");

const listCandidatesFromZip = (zip: JSZip): HunspellOxtCandidate[] => {
  const entries = Object.keys(zip.files)
    .filter((name) => name.toLowerCase().endsWith(".aff") || name.toLowerCase().endsWith(".dic"))
    .map((name) => ({
      name,
      baseName: normalizeBaseName(name.split("/").pop() ?? name),
      extension: name.toLowerCase().endsWith(".aff") ? "aff" : "dic",
    }));

  const grouped = new Map<
    string,
    {
      aff?: string;
      dic?: string;
      filePathAff?: string;
      filePathDic?: string;
    }
  >();

  entries.forEach((entry) => {
    const existing = grouped.get(entry.baseName) ?? {};
    if (entry.extension === "aff") {
      existing.filePathAff = entry.name;
    } else {
      existing.filePathDic = entry.name;
    }
    grouped.set(entry.baseName, existing);
  });

  const candidates = Array.from(grouped.entries())
    .filter(([, value]) => value.filePathAff && value.filePathDic)
    .map(([baseName, value]) => ({
      name: baseName,
      affPath: value.filePathAff as string,
      dicPath: value.filePathDic as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return candidates;
};

export const listHunspellPairsFromOxt = async (
  file: ArrayBuffer,
): Promise<HunspellOxtCandidate[]> => {
  const zip = await JSZip.loadAsync(file);
  return listCandidatesFromZip(zip);
};

export const extractHunspellFromOxt = async (
  file: ArrayBuffer,
  candidateName?: string,
): Promise<HunspellOxtEntry> => {
  const zip = await JSZip.loadAsync(file);
  const candidates = listCandidatesFromZip(zip);
  if (candidates.length === 0) {
    throw new Error("No Hunspell .aff/.dic pair found in .oxt archive.");
  }
  const candidate = candidateName
    ? candidates.find((entry) => entry.name === candidateName)
    : candidates[0];
  if (!candidate) {
    throw new Error("Requested dictionary was not found in .oxt archive.");
  }

  const [aff, dic] = await Promise.all([
    zip.file(candidate.affPath)?.async("string"),
    zip.file(candidate.dicPath)?.async("string"),
  ]);

  if (!aff || !dic) {
    throw new Error("Failed to read .aff/.dic content from .oxt archive.");
  }

  return {
    name: candidate.name,
    aff,
    dic,
  };
};
