import axios from "axios";
export const api = axios.create();
import type { CertificationMatrixDto } from "../types/matrix";

export async function fetchCertificationMatrix(): Promise<CertificationMatrixDto> {
  const res = await api.get<CertificationMatrixDto>("/certifications/matrix");
  return res.data;
}


