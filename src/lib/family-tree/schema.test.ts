import { describe, expect, it } from "vitest";
import { familyTreeData } from "./mock-data";
import { validateFamilyTreeData, validatePersonForm } from "./schema";

describe("validatePersonForm (A3)", () => {
  const base = {
    firstName: "Ana",
    lastName: "Ruiz",
    gender: "female",
    birthDate: "1970-05-02",
    deathDate: "",
    photoUrl: "",
    bio: "",
  };

  it("acepta una persona válida y normaliza vacíos a undefined", () => {
    const res = validatePersonForm(base);
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual({});
    expect(res.value).toMatchObject({
      firstName: "Ana",
      lastName: "Ruiz",
      gender: "female",
      birthDate: "1970-05-02",
    });
    expect(res.value?.deathDate).toBeUndefined();
    expect(res.value?.photoUrl).toBeUndefined();
  });

  it("exige nombre y apellidos en español", () => {
    const res = validatePersonForm({ ...base, firstName: "  ", lastName: "" });
    expect(res.ok).toBe(false);
    expect(res.errors.firstName).toContain("obligatorio");
    expect(res.errors.lastName).toContain("obligatorios");
  });

  it("rechaza fechas con mal formato, inexistentes e incoherentes", () => {
    expect(
      validatePersonForm({ ...base, birthDate: "02/05/1970" }).errors.birthDate
    ).toContain("AAAA-MM-DD");
    expect(
      validatePersonForm({ ...base, birthDate: "2024-02-30" }).errors.birthDate
    ).toContain("no existe");
    const inverted = validatePersonForm({
      ...base,
      birthDate: "2000-01-02",
      deathDate: "2000-01-01",
    });
    expect(inverted.ok).toBe(false);
    expect(inverted.errors.deathDate).toContain("anterior");
  });

  it("solo acepta fotos https:// o ruta /", () => {
    expect(
      validatePersonForm({ ...base, photoUrl: "https://x.com/f.jpg" }).ok
    ).toBe(true);
    expect(validatePersonForm({ ...base, photoUrl: "/foto.jpg" }).ok).toBe(
      true
    );
    expect(
      validatePersonForm({ ...base, photoUrl: "javascript:alert(1)" }).errors
        .photoUrl
    ).toContain("https://");
    expect(
      validatePersonForm({ ...base, photoUrl: "http://x.com/f.jpg" }).errors
        .photoUrl
    ).toContain("https://");
  });
});

describe("validateFamilyTreeData (A3)", () => {
  it("acepta el dataset Hawthorne", () => {
    expect(validateFamilyTreeData(familyTreeData).ok).toBe(true);
  });

  it("detecta duplicados, referencias rotas y unionId+singleParentId", () => {
    const dup = {
      ...familyTreeData,
      persons: [familyTreeData.persons[0], familyTreeData.persons[0]],
    };
    const dupRes = validateFamilyTreeData(dup);
    expect(dupRes.ok).toBe(false);
    expect(dupRes.errors.some((e) => e.includes("duplicado"))).toBe(true);

    const broken = {
      ...familyTreeData,
      unions: [
        {
          id: "u-x",
          partner1Id: "nadie",
          partner2Id: familyTreeData.persons[0].id,
          unionType: "marriage",
        },
      ],
    };
    expect(validateFamilyTreeData(broken).ok).toBe(false);

    const both = {
      ...familyTreeData,
      relationships: [
        {
          id: "r-x",
          childId: familyTreeData.persons[0].id,
          unionId: familyTreeData.unions[0].id,
          singleParentId: familyTreeData.persons[1].id,
          type: "biological",
        },
      ],
    };
    const bothRes = validateFamilyTreeData(both);
    expect(bothRes.ok).toBe(false);
    expect(bothRes.errors.some((e) => e.includes("excluyentes"))).toBe(true);
  });
});
