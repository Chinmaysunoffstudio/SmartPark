import React from 'react';
import { motion } from 'motion/react';
import { MapPin, QrCode, Shield, Clock, ArrowRight, Car, Sun, Moon } from 'lucide-react';

export default function LandingPage({ onGoToAuth }: { onGoToAuth: () => void }) {
  return (
    <div className="min-h-screen bg-surface-bg text-surface-text selection:bg-blue-500/30 font-sans overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-8 md:px-12">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">
            <Car className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-display font-black text-surface-text tracking-widest uppercase">ParkPrecision</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              const root = document.documentElement;
              const isDark = root.classList.contains('dark');
              if (isDark) {
                root.classList.remove('dark');
                localStorage.setItem('theme', 'light');
              } else {
                root.classList.add('dark');
                localStorage.setItem('theme', 'dark');
              }
            }}
            className="p-2 glass rounded-full text-surface-muted hover:text-surface-text transition-colors"
          >
            <Sun className="w-4 h-4 dark:hidden" />
            <Moon className="w-4 h-4 hidden dark:block" />
          </button>
          <button 
            onClick={onGoToAuth}
            className="px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all glass border border-surface-border rounded-full hover:bg-blue-600 hover:text-white backdrop-blur-md text-surface-text"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center pt-20 pb-32 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-10 text-[10px] font-black tracking-[0.2em] uppercase transition-all bg-blue-600/10 text-blue-500 rounded-full border border-blue-500/20">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full bg-blue-400 rounded-full opacity-75 animate-ping"></span>
              <span className="relative inline-flex w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            </span>
            System Operational
          </div>
          
          <h1 className="text-6xl md:text-9xl font-black tracking-tight leading-[0.85] mb-8 uppercase text-surface-text font-display">
            Park <span className="text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-700">Better.</span><br />
            Anywhere.
          </h1>
          
          <p className="max-w-xl mx-auto mb-12 text-sm md:text-base text-surface-muted font-medium leading-relaxed uppercase tracking-wide">
            Next-gen parking management with real-time mapping, automated slot allocation, and secure cloud sync.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onGoToAuth}
              className="group flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-xl shadow-blue-600/20"
            >
              Get Started Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#features" className="px-8 py-4 text-surface-muted hover:text-surface-text transition-colors duration-200 uppercase tracking-widest text-[10px] font-bold">
              Explore Alpha Features
            </a>
          </div>
        </motion.div>

        {/* 3D-Like Floating Visual */}
        <div className="relative mt-20 w-full max-w-5xl aspect-video md:aspect-[21/9] perspective-1000">
          <motion.div
            initial={{ opacity: 0, rotateX: 20, rotateY: -10, scale: 0.8 }}
            whileInView={{ 
              opacity: 1, 
              rotateX: 0, 
              rotateY: 0, 
              scale: 1,
              transition: { duration: 1.2, ease: "easeOut" }
            }}
            animate={{
              y: [0, -20, 0],
            }}
            transition={{
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="w-full h-full bg-surface-card rounded-3xl border border-surface-border shadow-[0_50px_100px_-20px_rgba(0,0,0,0.2)] overflow-hidden relative"
          >
             {/* Simulated Map / Interface View */}
            <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/parking-map/1200/600')] bg-cover opacity-20 grayscale" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-bg via-transparent to-transparent" />
            
            <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
               <div className="space-y-4">
                  <div className="h-12 w-48 bg-surface-bg/20 blur-sm rounded-lg border border-surface-border" />
                  <div className="flex gap-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="h-16 w-16 bg-blue-600/10 border border-blue-500/20 rounded-xl" />
                    ))}
                  </div>
               </div>
               <div className="p-8 bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-2xl">
                  <QrCode className="w-12 h-12 text-blue-500" />
               </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="relative z-10 px-6 py-32 bg-surface-card/30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {[
            { icon: MapPin, title: "Interactive Maps", desc: "Select and book your spot directly from our high-precision maps." },
            { icon: Clock, title: "Real-time Access", desc: "Live slot availability tracking with instant allocation." },
            { icon: QrCode, title: "QR Validation", desc: "Seamless entry and exit using secure QR code scanning." },
            { icon: Shield, title: "Secure Payments", desc: "Integrated payment gateway for worry-free transactions." }
          ].map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -10 }}
              className="p-8 bg-surface-bg border border-surface-border rounded-3xl hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-default"
            >
              <feature.icon className="w-10 h-10 text-blue-500 mb-6" />
              <h3 className="text-xl font-bold mb-3 text-surface-text">{feature.title}</h3>
              <p className="text-surface-muted text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-surface-border px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-surface-muted">
             <Car className="w-4 h-4" />
             <span className="text-xs font-medium uppercase tracking-[0.2em]">© 2026 ParkSmart AI Global</span>
          </div>
          <div className="flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-surface-muted">
            <a href="#" className="hover:text-surface-text transition-colors">Privacy</a>
            <a href="#" className="hover:text-surface-text transition-colors">Terms</a>
            <a href="#" className="hover:text-surface-text transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
