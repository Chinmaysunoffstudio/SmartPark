import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ParkingLocation, ParkingSlot, Booking } from '../types';
import { PUNE_MALLS } from '../lib/constants';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, MapPin, List, QrCode as QrIcon, Camera, X, Clock } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const [newLoc, setNewLoc] = useState({
    name: '',
    address: '',
    lat: 37.7749, // Default SF
    lng: -122.4194,
    totalSlots: 10
  });

  // Seed Pune Malls if empty (Migration to Supabase)
  useEffect(() => {
    const seedMalls = async () => {
      if (!profile?.uid) return;

      const { data: existingMalls } = await supabase.from('locations').select('name');
      const existingNames = existingMalls?.map(m => m.name) || [];

      for (const mall of PUNE_MALLS) {
        if (!existingNames.includes(mall.name)) {
          const { data: locData, error: locError } = await supabase
            .from('locations')
            .insert({
              name: mall.name,
              address: mall.address,
              lat: mall.lat,
              lng: mall.lng,
              total_slots: mall.levels.length * 100,
              levels: mall.levels,
              admin_id: profile.uid,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (locData && !locError) {
            const SECTIONS = ["A", "B", "C", "D"];
            const allSlots = [];
            for (const level of mall.levels) {
              for (const section of SECTIONS) {
                for (let i = 1; i <= 25; i++) {
                  allSlots.push({
                    location_id: locData.id,
                    slot_number: `${level}-${section}${i.toString().padStart(2, '0')}`,
                    level: level,
                    section: section,
                    is_available: Math.random() > 0.4,
                    type: 'standard'
                  });
                }
              }
            }
            await supabase.from('slots').insert(allSlots);
          }
        }
      }
    };
    seedMalls();
  }, [profile]);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from('locations').select('*');
      if (data) setLocations(data.map(item => ({
        ...item,
        totalSlots: item.total_slots,
        adminId: item.admin_id,
        createdAt: item.created_at
      })));
    };
    fetchLocations();

    const subscription = supabase
      .channel('admin_locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, fetchLocations)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  // Fetch active bookings
  useEffect(() => {
    const fetchBookings = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'active');
      
      if (data) setBookings(data.map(item => ({
        ...item,
        userId: item.user_id,
        locationId: item.location_id,
        slotId: item.slot_id,
        startTime: item.start_time,
        endTime: item.end_time,
        qrData: item.qr_data,
        createdAt: item.created_at
      })));
    };
    fetchBookings();

    const subscription = supabase
      .channel('admin_bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: 'status=eq.active' }, fetchBookings)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  // QR Scanner Logic
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (scanning) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((result) => {
        setScanResult(result);
        setScanning(false);
        handleProcessScan(result);
        if (scanner) scanner.clear();
      }, (error) => {
        // Handle error
      });
    }
    return () => {
      if (scanner) scanner.clear();
    };
  }, [scanning]);

  const handleProcessScan = async (qrData: string) => {
    // Find booking with this qrData
    const { data: bookingData, error: bookingErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('qr_data', qrData)
      .eq('status', 'active')
      .single();

    if (bookingData && !bookingErr) {
        const booking = bookingData;
        // Mark as completed for now (In/Out logic)
        await supabase
          .from('bookings')
          .update({
            status: 'completed',
            scanned_in_at: new Date().toISOString(),
            scanned_out_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        // Make slot available again
        await supabase
          .from('slots')
          .update({ is_available: true })
          .eq('id', booking.slot_id);

        alert('Car processing complete. Slot is now free.');
    } else {
        alert('Invalid or inactive QR code.');
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const { data: locData, error: locErr } = await supabase
        .from('locations')
        .insert({
          name: newLoc.name,
          address: newLoc.address,
          lat: newLoc.lat,
          lng: newLoc.lng,
          total_slots: newLoc.totalSlots,
          admin_id: profile.uid,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (locErr || !locData) throw locErr;

      // Automatically generate slots
      const slotsToInsert = [];
      for (let i = 1; i <= newLoc.totalSlots; i++) {
        slotsToInsert.push({
          location_id: locData.id,
          slot_number: `S${i}`,
          is_available: true,
          type: 'standard'
        });
      }
      
      const { error: slotsErr } = await supabase.from('slots').insert(slotsToInsert);
      if (slotsErr) throw slotsErr;

      setIsAdding(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (confirm('Delete this location and all its slots?')) {
        // In Supabase, if cascade is set up in schema, deleting location deletes slots
        // Otherwise we'd need to delete slots first. Assuming cascade for now, or just deleting location.
        // Actually, let's delete slots first just in case.
        await supabase.from('slots').delete().eq('location_id', id);
        await supabase.from('locations').delete().eq('id', id);
    }
  };

  return (
    <div className="pt-24 px-6 md:px-12 pb-20 max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-surface-text uppercase tracking-tight">Infrastructure Node</h1>
          <p className="text-surface-muted uppercase tracking-tighter text-xs font-bold">Manage parking grid and monitor real-time traffic flow.</p>
        </div>
        <div className="flex gap-4">
            <button 
                onClick={() => setScanning(true)}
                className="flex items-center gap-2 px-6 py-3 glass border border-surface-border hover:bg-surface-border/10 text-surface-text rounded-xl font-bold transition-all backdrop-blur-md uppercase text-[10px] tracking-widest"
            >
                <Camera className="w-4 h-4 text-blue-500" /> In/Out Scanner
            </button>
            <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 uppercase text-[10px] tracking-widest"
            >
                <Plus className="w-4 h-4" /> Register Node
            </button>
        </div>
      </header>

      {scanning && (
        <div className="fixed inset-0 z-[200] bg-surface-bg/90 backdrop-blur-lg flex items-center justify-center p-6">
            <div className="relative w-full max-w-md bg-surface-bg rounded-3xl p-8 border border-surface-border shadow-2xl">
                <button onClick={() => setScanning(false)} className="absolute top-4 right-4 p-2 text-surface-muted hover:text-surface-text transition-colors"><X /></button>
                <h2 className="text-sm font-bold text-surface-text mb-6 uppercase tracking-widest">Identify Access Key</h2>
                <div id="reader" className="w-full overflow-hidden rounded-2xl bg-surface-card border border-surface-border grayscale"></div>
                <p className="mt-6 text-[10px] text-surface-muted text-center uppercase tracking-widest font-bold">Align QR token within the visual frame</p>
            </div>
        </div>
      )}

      {isAdding && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-10 glass border border-surface-border rounded-3xl max-w-xl mx-auto shadow-2xl">
          <form onSubmit={handleAddLocation} className="space-y-6">
            <h2 className="text-sm font-bold text-surface-text uppercase tracking-widest mb-8">Deploy New Infrastructure</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                placeholder="Node Name" 
                className="w-full p-4 bg-surface-card border border-surface-border rounded-xl text-surface-text outline-none focus:border-blue-500 transition-colors text-xs font-mono"
                value={newLoc.name} onChange={e => setNewLoc({...newLoc, name: e.target.value})}
                required
              />
              <input 
                placeholder="Grid Capacity" type="number"
                className="w-full p-4 bg-surface-card border border-surface-border rounded-xl text-surface-text outline-none focus:border-blue-500 transition-colors text-xs font-mono"
                value={newLoc.totalSlots} onChange={e => setNewLoc({...newLoc, totalSlots: parseInt(e.target.value)})}
                required
              />
            </div>
            <input 
                placeholder="Physical Address"
                className="w-full p-4 bg-surface-card border border-surface-border rounded-xl text-surface-text outline-none focus:border-blue-500 transition-colors text-xs font-mono"
                value={newLoc.address} onChange={e => setNewLoc({...newLoc, address: e.target.value})}
                required
            />
             <div className="grid grid-cols-2 gap-4">
               <input placeholder="LAT" type="number" step="any" className="w-full p-4 bg-surface-card border border-surface-border rounded-xl text-surface-text outline-none focus:border-blue-500 transition-colors text-xs font-mono" value={newLoc.lat} onChange={e => setNewLoc({...newLoc, lat: parseFloat(e.target.value)})} required />
               <input placeholder="LONG" type="number" step="any" className="w-full p-4 bg-surface-card border border-surface-border rounded-xl text-surface-text outline-none focus:border-blue-500 transition-colors text-xs font-mono" value={newLoc.lng} onChange={e => setNewLoc({...newLoc, lng: parseFloat(e.target.value)})} required />
             </div>
            <div className="flex gap-4 pt-8">
                <button type="submit" className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all uppercase text-xs tracking-widest">Initialize Node</button>
                <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-4 glass text-surface-muted hover:text-surface-text rounded-xl transition-all uppercase text-xs tracking-widest font-bold">Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Locations List */}
        <div className="lg:col-span-2 space-y-6">
            <h3 className="text-surface-muted font-bold uppercase tracking-widest text-[10px]">Active Nodes ({locations.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locations.map(loc => (
                    <div key={loc.id} className="p-8 glass border border-surface-border rounded-3xl group hover:border-blue-500/30 transition-all shadow-xl">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-blue-600/10 text-blue-500 rounded-xl border border-blue-500/20"><MapPin className="w-5 h-5" /></div>
                            <button onClick={() => handleDeleteLocation(loc.id)} className="text-surface-muted hover:text-red-500 transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <h4 className="font-bold text-xl text-surface-text mb-2">{loc.name}</h4>
                        <p className="text-[10px] text-surface-muted mb-6 uppercase tracking-tighter font-mono line-clamp-1">{loc.address}</p>
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-surface-card rounded text-[10px] font-mono text-surface-muted border border-surface-border">{loc.totalSlots} UNITS</span>
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Sync_Active</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Monitoring Panel */}
        <div className="space-y-6">
            <h3 className="text-surface-muted font-bold uppercase tracking-widest text-[10px]">Real-Time Traffic ({bookings.length})</h3>
            <div className="space-y-3">
                {bookings.map(book => (
                    <div key={book.id} className="p-6 glass border border-surface-border rounded-2xl flex items-center justify-between group hover:bg-surface-border/5 transition-colors">
                        <div>
                            <p className="text-[10px] font-mono text-surface-muted mb-1 uppercase tracking-tighter">UID: {book.userId.slice(0,10)}</p>
                            <p className="text-[9px] text-surface-muted flex items-center gap-1 uppercase font-bold tracking-widest"><Clock className="w-3 h-3" /> SESSION_ID: {book.id.slice(0,8)}</p>
                        </div>
                        <div className="text-right">
                           <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-lg shadow-blue-500/5">Active_Node</span>
                        </div>
                    </div>
                ))}
                {bookings.length === 0 && (
                    <div className="p-16 text-center border border-dashed border-surface-border rounded-3xl">
                        <QrIcon className="w-10 h-10 text-surface-muted/20 mx-auto mb-4" />
                        <p className="text-[10px] text-surface-muted font-bold uppercase tracking-widest">No Active Sessions Detected</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
