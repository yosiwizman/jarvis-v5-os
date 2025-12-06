import Link from 'next/link';

const cards = [
  { href: '/jarvis', title: 'Jarvis (Voice)', desc: 'OpenAI Realtime voice assistant' },
  { href: '/3dmodel', title: '3D Model', desc: 'Create models from captured images' },
  { href: '/createimage', title: 'Create Image', desc: 'Generate images from prompts' },
  { href: '/3dprinters', title: '3D Printers', desc: 'Monitor and control Bambu Lab printers' },
  { href: '/files', title: 'Files', desc: 'Shared library of generated assets' },
  { href: '/chat', title: 'Chat', desc: 'Text chat with function calling' },
  { href: '/security', title: 'Security', desc: 'Live dashboard for connected cameras' },
  { href: '/camera', title: 'Camera', desc: 'Register a device as a camera client' },
  { href: '/holomat', title: 'Holomat', desc: 'Futuristic scanning interface with camera sync' },
  { href: '/settings', title: 'Settings', desc: 'Jarvis & Meshy configuration' }
];

export default function MenuPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.href} href={card.href as any} className="card p-6 hover:border-white/20 transition block">
          <div className="text-lg font-semibold">{card.title}</div>
          <div className="mt-2 text-white/60">{card.desc}</div>
          <div className="mt-4 text-sky-300">Go →</div>
        </Link>
      ))}
    </div>
  );
}
