import { GoogleGenAI, Type } from "@google/genai";
import { PatientData, ScreeningData } from "@/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const SYSTEM_INSTRUCTION = `
Anda adalah BatukCare, asisten AI khusus untuk memberikan informasi mengenai penyakit Tuberkulosis (TBC) dan kondisi batuk lainnya.
Tugas utama Anda adalah membantu pengguna memahami gejala, pencegahan, dan langkah-langkah yang harus diambil jika mereka mencurigai adanya infeksi TBC atau masalah pernapasan lainnya.

Pedoman Penting:
1. SELALU sertakan penafian (disclaimer) di awal atau akhir jawaban bahwa Anda adalah AI dan bukan pengganti saran medis profesional.
2. Berikan informasi yang akurat berdasarkan standar kesehatan (seperti WHO atau Kemenkes RI).
3. Jika pengguna menyebutkan gejala seperti batuk lebih dari 2 minggu, keringat malam tanpa aktivitas, atau penurunan berat badan drastis, sarankan mereka untuk SEGERA mengunjungi Puskesmas atau dokter terdekat.
4. Gunakan bahasa Indonesia yang ramah, empatik, dan mudah dimengerti.
5. Jangan memberikan diagnosis pasti. Gunakan kata-kata seperti "mengarah pada", "kemungkinan", atau "gejala umum".
6. Jelaskan bahwa TBC bisa disembuhkan dengan pengobatan yang rutin dan tuntas.
`;

export async function askGemini(prompt: string, history: { role: "user" | "model"; parts: { text: string }[] }[] = []) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: "user", parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    return response.text || "Maaf, saya tidak dapat memberikan jawaban saat ini.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Terjadi kesalahan saat menghubungi asisten AI. Silakan coba lagi nanti.";
  }
}

export async function analyzeScreening(patient: PatientData, screening: ScreeningData) {
  const prompt = `
  Lakukan analisis skrining TBC berdasarkan data berikut:
  
  Data Pasien:
  - Nama: ${patient.name}
  - Jenis Kelamin: ${patient.gender}
  - Usia: ${patient.age}
  - Alamat: ${patient.address}
  - Nomor Telepon: ${patient.phone}
  
  Gejala & Riwayat:
  - Batuk: ${screening.hasCough ? 'Ya' : 'Tidak'}
  - Durasi Batuk: ${screening.coughDuration}
  - Demam: ${screening.hasFever ? 'Ya' : 'Tidak'}
  - Keringat Malam: ${screening.hasNightSweat ? 'Ya' : 'Tidak'}
  - Penurunan Berat Badan: ${screening.hasWeightLoss ? 'Ya' : 'Tidak'}
  - Nyeri Dada: ${screening.hasChestPain ? 'Ya' : 'Tidak'}
  - Riwayat Kontak Pasien TBC: ${screening.hasHistoryContact ? 'Ya' : 'Tidak'}
  
  Tugas:
  1. Tentukan apakah pasien masuk kategori "Terduga TBC" atau "Bukan Terduga TBC" berdasarkan kriteria medis umum (Batuk > 2 minggu atau batuk disertai gejala tambahan lainnya).
  2. Berikan penjelasan singkat mengapa kesimpulan tersebut diambil.
  3. Berikan rekomendasi langkah selanjutnya (misal: periksa ke Puskesmas, lakukan tes dahak/Sputum, atau tetap jaga kesehatan).
  4. Sertakan disclaimer medis.
  
  Format jawaban harus dalam JSON dengan struktur:
  {
    "isSuspected": boolean,
    "conclusion": string,
    "explanation": string,
    "recommendations": string[]
  }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSuspected: { type: Type.BOOLEAN },
            conclusion: { type: Type.STRING },
            explanation: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["isSuspected", "conclusion", "explanation", "recommendations"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Screening Analysis Error:", error);
    return null;
  }
}
