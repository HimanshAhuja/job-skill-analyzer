/** @type {import('next').NextConfig} */
const nextConfig = {
  // native / heavy packages are loaded by Node at runtime, not bundled
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'pdf-parse', 'pg'],
};
export default nextConfig;
