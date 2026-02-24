// export async function fetchWithTimeout(
//   input: RequestInfo | URL,
//   init: RequestInit = {},
//   timeoutMs = 15000,
// ) {
//   console.log(`fetch`);
//   const controller = new AbortController();
//   const timeout = setTimeout(() => controller.abort(), timeoutMs);
//   try {
//     return await fetch(input, { ...init, signal: controller.signal });
//   } finally {
//     clearTimeout(timeout);
//   }
// }

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  return fetch(input, init);
}
