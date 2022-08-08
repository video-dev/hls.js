export type NetworkDetails =
  | null // this is a nullable field in several callback interfaces
  | Response // from utils/fetch-loader.ts
  | XMLHttpRequest; // from utils/xhr-loader.ts
