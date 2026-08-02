/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	async redirects() {
		return [
			{
				source: '/index.html',
				destination: '/',
				permanent: false,
			},
			{
				source: '/text-prompt.html',
				destination: '/text',
				permanent: false,
			},
			{
				source: '/image-prompt.html',
				destination: '/image',
				permanent: false,
			},
		];
	},
};

export default nextConfig;
