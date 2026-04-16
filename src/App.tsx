/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  Stethoscope, 
  Info, 
  AlertCircle, 
  MessageSquare, 
  User, 
  Bot,
  RefreshCcw,
  ChevronRight,
  ShieldCheck,
  Activity,
  ClipboardCheck,
  MapPin,
  CheckCircle2,
  XCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { askGemini, analyzeScreening } from "@/lib/gemini";
import { 
  saveScreeningToFirebase, 
  getScreeningsFromFirebase, 
  signInWithGoogle, 
  logout, 
  onAuthChange, 
  User as FirebaseUser 
} from "@/lib/firebase";
import { Message, PatientData, ScreeningData } from "@/types";
import { cn } from "@/lib/utils";

const QUICK_QUESTIONS = [
  "Apa saja gejala umum TBC?",
  "Bagaimana cara penularan TBC?",
  "Apakah TBC bisa disembuhkan?",
  "Kapan saya harus ke dokter?",
  "Bagaimana cara mencegah penularan TBC di rumah?"
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      content: "Halo! Saya asisten AI BatukCare. Saya di sini untuk memberikan informasi mengenai penyakit Tuberkulosis (TBC) dan kondisi batuk lainnya. Apa yang ingin Anda ketahui hari ini?\n\n*Catatan: Saya adalah AI, bukan dokter. Informasi ini hanya untuk tujuan edukasi.*",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScreeningOpen, setIsScreeningOpen] = useState(false);
  const [screeningStep, setScreeningStep] = useState(1);
  const [patientData, setPatientData] = useState<PatientData>({
    name: "",
    gender: "",
    age: "",
    address: "",
    phone: ""
  });
  const [screeningData, setScreeningData] = useState<ScreeningData>({
    hasCough: false,
    coughDuration: "",
    hasFever: false,
    hasNightSweat: false,
    hasWeightLoss: false,
    hasChestPain: false,
    hasHistoryContact: false
  });
  const [screeningResult, setScreeningResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const OWNER_EMAIL = "ahmadjafahu@yahoo.co.id";

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setLoginError("Jendela login ditutup sebelum selesai. Silakan coba lagi.");
      } else if (error.code === 'auth/blocked-at-popup-request') {
        setLoginError("Popup diblokir oleh browser. Izinkan popup untuk login.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError("Domain ini belum terdaftar di Firebase. Hubungi admin.");
      } else if (error.code === 'auth/network-request-failed') {
        setLoginError("Koneksi internet bermasalah. Coba lagi nanti.");
      } else {
        setLoginError(`Login gagal: ${error.code || "Terjadi kesalahan sistem"}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Load history from Firebase on mount
  useEffect(() => {
    const loadHistory = async () => {
      const data = await getScreeningsFromFirebase();
      if (data) {
        setHistory(data);
      }
    };
    loadHistory();
  }, []);

  const saveToHistory = async (patient: PatientData, result: any) => {
    await saveScreeningToFirebase(patient, result);
    // Refresh history after saving
    const data = await getScreeningsFromFirebase();
    if (data) {
      setHistory(data);
    }
  };

  const downloadCSV = () => {
    if (history.length === 0) return;
    
    const headers = ["Nama", "Jenis Kelamin", "Usia", "Alamat", "No HP", "Kesimpulan", "Tanggal"];
    const rows = history.map(h => [
      h.name,
      h.gender,
      h.age,
      h.address,
      h.phone,
      h.conclusion,
      h.timestamp
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `data_skrining_batukcare_${new Date().getTime()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const history = messages.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const response = await askGemini(text, history);

    const modelMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "model",
      content: response,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, modelMessage]);
    setIsLoading(false);
  };

  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "model",
        content: "Halo! Saya asisten AI BatukCare. Saya di sini untuk memberikan informasi mengenai penyakit Tuberkulosis (TBC) dan kondisi batuk lainnya. Apa yang ingin Anda ketahui hari ini?\n\n*Catatan: Saya adalah AI, bukan dokter. Informasi ini hanya untuk tujuan edukasi.*",
        timestamp: Date.now(),
      },
    ]);
  };

  const handleScreeningSubmit = async () => {
    setIsAnalyzing(true);
    const result = await analyzeScreening(patientData, screeningData);
    setScreeningResult(result);
    if (result) {
      saveToHistory(patientData, result);
    }
    setIsAnalyzing(false);
    setScreeningStep(3);
  };

  const resetScreening = () => {
    setScreeningStep(1);
    setPatientData({ name: "", gender: "", age: "", address: "", phone: "" });
    setScreeningData({
      hasCough: false,
      coughDuration: "",
      hasFever: false,
      hasNightSweat: false,
      hasWeightLoss: false,
      hasChestPain: false,
      hasHistoryContact: false
    });
    setScreeningResult(null);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <Stethoscope size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">BatukCare</h1>
              <p className="text-xs font-medium text-blue-600">Konsultasikan Kondisi Batukmu</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-bold text-slate-900">{user.displayName}</p>
                  <p className="text-[10px] text-slate-500">{user.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700">
                  Keluar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {loginError && (
                  <span className="hidden text-[10px] font-medium text-red-500 lg:block">
                    {loginError}
                  </span>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogin} 
                  disabled={isLoggingIn}
                  className="text-xs text-blue-600 hover:bg-blue-50"
                >
                  {isLoggingIn ? "Memproses..." : "Login Admin"}
                </Button>
              </div>
            )}
            <Dialog open={isScreeningOpen} onOpenChange={(open) => {
              setIsScreeningOpen(open);
              if (!open) resetScreening();
            }}>
              <DialogTrigger render={
                <Button className="hidden h-11 bg-blue-600 px-6 font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-blue-300 sm:flex">
                  <ClipboardCheck className="mr-2 h-5 w-5" />
                  Skrining Mandiri
                </Button>
              } />
              <DialogContent className="max-w-md sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ClipboardCheck className="text-blue-600" />
                    Skrining Gejala TBC
                  </DialogTitle>
                  <DialogDescription>
                    Lengkapi data berikut untuk membantu kami menganalisis kondisi Anda.
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh] px-1">
                  <div className="py-4 pr-3">
                  {screeningStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nama Lengkap</Label>
                        <Input 
                          id="name" 
                          placeholder="Masukkan nama Anda" 
                          value={patientData.name}
                          onChange={(e) => setPatientData({...patientData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Jenis Kelamin</Label>
                        <RadioGroup 
                          value={patientData.gender} 
                          onValueChange={(val: any) => setPatientData({...patientData, gender: val})}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Laki-laki" id="male" />
                            <Label htmlFor="male">Laki-laki</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Perempuan" id="female" />
                            <Label htmlFor="female">Perempuan</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="age">Usia</Label>
                        <Input 
                          id="age" 
                          type="number"
                          placeholder="Masukkan usia Anda" 
                          value={patientData.age}
                          onChange={(e) => setPatientData({...patientData, age: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Alamat / Domisili</Label>
                        <Input 
                          id="address" 
                          placeholder="Kota atau Kecamatan" 
                          value={patientData.address}
                          onChange={(e) => setPatientData({...patientData, address: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Nomor Telepon</Label>
                        <Input 
                          id="phone" 
                          type="tel"
                          placeholder="Contoh: 08123456789" 
                          value={patientData.phone}
                          onChange={(e) => setPatientData({...patientData, phone: e.target.value})}
                        />
                      </div>
                      <Button 
                        className="w-full bg-blue-600" 
                        disabled={!patientData.name || !patientData.gender || !patientData.age || !patientData.address || !patientData.phone}
                        onClick={() => setScreeningStep(2)}
                      >
                        Lanjut ke Gejala
                      </Button>
                    </div>
                  )}

                  {screeningStep === 2 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">Gejala yang Dirasakan</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        {[
                          { id: "cough", label: "Apakah Anda mengalami Batuk?", field: "hasCough" },
                          { id: "fever", label: "Apakah Anda Demam / Meriang?", field: "hasFever" },
                          { id: "sweat", label: "Apakah sering Keringat Malam tanpa aktivitas?", field: "hasNightSweat" },
                          { id: "weight", label: "Apakah Berat Badan turun drastis?", field: "hasWeightLoss" },
                          { id: "chest", label: "Apakah merasa Nyeri Dada / Sesak?", field: "hasChestPain" },
                          { id: "contact", label: "Pernah kontak dengan pasien TBC?", field: "hasHistoryContact" },
                        ].map((symptom) => (
                          <div key={symptom.id} className="flex flex-col gap-3 rounded-xl border bg-slate-50/50 p-4 transition-colors hover:bg-white">
                            <Label className="text-sm font-medium leading-normal text-slate-700">
                              {symptom.label}
                            </Label>
                            <RadioGroup 
                              value={(screeningData as any)[symptom.field] ? "yes" : "no"} 
                              onValueChange={(val) => setScreeningData({...screeningData, [symptom.field]: val === "yes"})}
                              className="flex gap-3"
                            >
                              <div className="flex-1">
                                <RadioGroupItem value="yes" id={`${symptom.id}-y`} className="peer sr-only" />
                                <Label
                                  htmlFor={`${symptom.id}-y`}
                                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition-all peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-600 peer-data-[state=checked]:text-white hover:bg-slate-50"
                                >
                                  {(screeningData as any)[symptom.field] === true && <CheckCircle2 size={16} />}
                                  Ya
                                </Label>
                              </div>
                              <div className="flex-1">
                                <RadioGroupItem value="no" id={`${symptom.id}-n`} className="peer sr-only" />
                                <Label
                                  htmlFor={`${symptom.id}-n`}
                                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition-all peer-data-[state=checked]:border-slate-600 peer-data-[state=checked]:bg-slate-600 peer-data-[state=checked]:text-white hover:bg-slate-50"
                                >
                                  {(screeningData as any)[symptom.field] === false && <XCircle size={16} />}
                                  Tidak
                                </Label>
                              </div>
                            </RadioGroup>

                            {symptom.id === "cough" && screeningData.hasCough && (
                              <div className="mt-2 space-y-2 border-t pt-2">
                                <Label className="text-xs font-semibold text-slate-500">Berapa lama durasi batuk Anda?</Label>
                                <Select 
                                  value={screeningData.coughDuration} 
                                  onValueChange={(val) => setScreeningData({...screeningData, coughDuration: val})}
                                >
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Pilih durasi batuk" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Kurang dari 1 minggu">Kurang dari 1 minggu</SelectItem>
                                    <SelectItem value="1-2 minggu">1 - 2 minggu</SelectItem>
                                    <SelectItem value="Lebih dari 2 minggu">Lebih dari 2 minggu</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => setScreeningStep(1)}>
                          Kembali
                        </Button>
                        <Button className="flex-[2] bg-blue-600 py-6 text-lg font-bold" onClick={handleScreeningSubmit} disabled={isAnalyzing}>
                          {isAnalyzing ? (
                            <div className="flex items-center gap-2">
                              <RefreshCcw className="h-4 w-4 animate-spin" />
                              Menganalisis...
                            </div>
                          ) : "Mulai Analisis"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {screeningStep === 3 && screeningResult && (
                    <div className="space-y-4">
                      <div className={cn(
                        "flex flex-col items-center gap-3 rounded-xl p-6 text-center",
                        screeningResult.isSuspected ? "bg-red-50 text-red-900 border border-red-100" : "bg-green-50 text-green-900 border border-green-100"
                      )}>
                        {screeningResult.isSuspected ? (
                          <AlertCircle size={48} className="text-red-500" />
                        ) : (
                          <CheckCircle2 size={48} className="text-green-500" />
                        )}
                        <div>
                          <h3 className="text-xl font-bold">{screeningResult.conclusion}</h3>
                          <p className="mt-2 text-sm opacity-90">{screeningResult.explanation}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Rekomendasi:</h4>
                        <ul className="space-y-1">
                          {screeningResult.recommendations.map((rec: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Separator />

                      <div className="rounded-lg bg-slate-100 p-3 text-[10px] leading-tight text-slate-500 italic">
                        Disclaimer: Hasil ini dihasilkan oleh AI berdasarkan data yang Anda berikan dan bukan merupakan diagnosis medis resmi. Silakan konsultasikan dengan tenaga medis profesional untuk pemeriksaan lebih lanjut.
                      </div>

                      <Button className="w-full" onClick={() => setIsScreeningOpen(false)}>
                        Tutup & Lanjut Chat
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={resetChat} title="Reset Percakapan">
              <RefreshCcw size={20} className="text-slate-500" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Chat */}
          <div className="lg:col-span-8">
            <Card className="flex h-[calc(100vh-12rem)] flex-col border-none shadow-xl shadow-slate-200/50">
              <CardHeader className="border-b bg-white py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-blue-500" />
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Asisten AI BatukCare
                    </CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-blue-600 sm:hidden"
                    onClick={() => setIsScreeningOpen(true)}
                  >
                    Skrining
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea ref={scrollAreaRef} className="h-full p-4">
                  <div className="space-y-6">
                    <Alert variant="default" className="border-blue-100 bg-blue-50 text-blue-800">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-xs font-bold uppercase">Peringatan Medis</AlertTitle>
                      <AlertDescription className="text-xs leading-relaxed">
                        Aplikasi ini hanya memberikan informasi edukasi. Jika Anda mengalami batuk lebih dari 2 minggu, sesak napas, atau nyeri dada, segera hubungi fasilitas kesehatan terdekat.
                      </AlertDescription>
                    </Alert>

                    <AnimatePresence initial={false}>
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex w-full gap-3",
                            msg.role === "user" ? "flex-row-reverse" : "flex-row"
                          )}
                        >
                          <div className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm",
                            msg.role === "user" ? "bg-slate-800 text-white" : "bg-blue-100 text-blue-600"
                          )}>
                            {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                          </div>
                          <div className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                            msg.role === "user" 
                              ? "bg-blue-600 text-white rounded-tr-none" 
                              : "bg-white border text-slate-700 rounded-tl-none"
                          )}>
                            <div className="prose prose-sm max-w-none prose-slate">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <Bot size={16} />
                        </div>
                        <div className="flex items-center gap-1 rounded-2xl bg-white border px-4 py-3">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="h-1.5 w-1.5 rounded-full bg-blue-400"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                            className="h-1.5 w-1.5 rounded-full bg-blue-400"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                            className="h-1.5 w-1.5 rounded-full bg-blue-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              <div className="border-t bg-white p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Tanyakan sesuatu tentang TBC..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="border-slate-200 bg-slate-50 focus-visible:ring-blue-500"
                  />
                  <Button type="submit" disabled={isLoading || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
                    <Send size={18} />
                  </Button>
                </form>
              </div>
            </Card>
          </div>

          {/* Right Column: Info & Quick Links */}
          <div className="space-y-6 lg:col-span-4">
            <Card className="border-none shadow-lg shadow-slate-200/50">
              <CardHeader>
                <div className="flex items-center gap-2 text-blue-600">
                  <ShieldCheck size={20} />
                  <CardTitle className="text-lg">Informasi Cepat</CardTitle>
                </div>
                <CardDescription>Pertanyaan yang sering diajukan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="group flex w-full items-center justify-between rounded-lg border border-slate-100 bg-white p-3 text-left text-sm transition-all hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="text-slate-600 group-hover:text-blue-700">{q}</span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400" />
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-none bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                  <Info size={24} />
                </div>
                <h3 className="mb-2 text-lg font-bold">Tahukah Anda?</h3>
                <p className="text-sm leading-relaxed text-blue-50/90">
                  TBC bukan penyakit keturunan atau guna-guna. TBC disebabkan oleh bakteri dan bisa disembuhkan total dengan pengobatan rutin selama 6-9 bulan.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-white/10 text-white border-none">#TBCBisaSembuh</Badge>
                  <Badge variant="secondary" className="bg-white/10 text-white border-none">#TosTBC</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
              <p className="mb-3 text-xs font-medium text-slate-500">
                Layanan Informasi TBC Terpadu &copy; 2026
              </p>
              {user?.email === OWNER_EMAIL ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={downloadCSV}
                  disabled={history.length === 0}
                >
                  Unduh Data (.csv)
                </Button>
              ) : (
                <p className="text-[10px] text-slate-400">
                  Akses data hanya untuk admin terdaftar.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
