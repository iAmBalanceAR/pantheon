/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', 'openai'],
    // Include markdown skill files in Vercel serverless bundles.
    // These are read from the filesystem at runtime by skill-loader.ts.
    outputFileTracingIncludes: {
      '/**': [
        './src/lib/agents/skills/**/*.md',
        './src/lib/agents/skills-library/**/*.md',
        './src/content/help/**/*.md',
      ],
    },
  },
}

export default nextConfig
