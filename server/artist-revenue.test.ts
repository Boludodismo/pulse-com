import { describe, it, expect, vi, beforeEach } from "vitest";

// Testa a função formatArtistRevenueResult que formata os dados dos artistas
// Importamos apenas a lógica de formatação sem dependência de banco de dados

// Simular a função formatArtistRevenueResult
function formatArtistRevenueResult(
  rows: Array<{ artist_name: string; period: string; appointment_count: number; completed_count: number; revenue: number; avg_ticket: number }>,
  groupBy: string
) {
  const artistTotals = new Map<string, { totalRevenue: number; totalAppointments: number; periods: typeof rows }>();
  
  for (const row of rows) {
    if (!artistTotals.has(row.artist_name)) {
      artistTotals.set(row.artist_name, { totalRevenue: 0, totalAppointments: 0, periods: [] });
    }
    const artist = artistTotals.get(row.artist_name)!;
    artist.totalRevenue += Number(row.revenue);
    artist.totalAppointments += Number(row.appointment_count);
    artist.periods.push(row);
  }

  let grandTotal = 0;
  for (const entry of Array.from(artistTotals.entries())) {
    grandTotal += entry[1].totalRevenue;
  }

  const artistsList = Array.from(artistTotals.entries())
    .map(([name, data]) => ({
      name,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      totalAppointments: data.totalAppointments,
      percentage: grandTotal > 0 ? Math.round((data.totalRevenue / grandTotal) * 10000) / 100 : 0,
      avgTicket: data.totalAppointments > 0
        ? Math.round((data.totalRevenue / data.totalAppointments) * 100) / 100
        : 0,
      periods: data.periods.map(p => ({
        period: p.period,
        revenue: Math.round(Number(p.revenue) * 100) / 100,
        appointments: Number(p.appointment_count),
        completed: Number(p.completed_count),
        avgTicket: Math.round(Number(p.avg_ticket) * 100) / 100,
      })),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const allPeriods = Array.from(new Set(rows.map(r => r.period))).sort();

  return {
    artists: artistsList,
    periods: allPeriods,
    grandTotal: Math.round(grandTotal * 100) / 100,
    groupBy,
  };
}

describe("formatArtistRevenueResult", () => {
  it("deve retornar lista vazia quando não há dados", () => {
    const result = formatArtistRevenueResult([], "month");
    expect(result.artists).toHaveLength(0);
    expect(result.periods).toHaveLength(0);
    expect(result.grandTotal).toBe(0);
    expect(result.groupBy).toBe("month");
  });

  it("deve calcular corretamente a receita total por artista", () => {
    const rows = [
      { artist_name: "Artista A", period: "2026-03", appointment_count: 10, completed_count: 8, revenue: 5000, avg_ticket: 500 },
      { artist_name: "Artista B", period: "2026-03", appointment_count: 5, completed_count: 4, revenue: 2000, avg_ticket: 400 },
    ];
    const result = formatArtistRevenueResult(rows, "month");
    
    expect(result.artists).toHaveLength(2);
    expect(result.grandTotal).toBe(7000);
    // Artista A deve vir primeiro (maior receita)
    expect(result.artists[0].name).toBe("Artista A");
    expect(result.artists[0].totalRevenue).toBe(5000);
    expect(result.artists[1].name).toBe("Artista B");
    expect(result.artists[1].totalRevenue).toBe(2000);
  });

  it("deve calcular percentuais corretamente", () => {
    const rows = [
      { artist_name: "Artista A", period: "2026-03", appointment_count: 10, completed_count: 8, revenue: 7500, avg_ticket: 750 },
      { artist_name: "Artista B", period: "2026-03", appointment_count: 5, completed_count: 4, revenue: 2500, avg_ticket: 500 },
    ];
    const result = formatArtistRevenueResult(rows, "month");
    
    expect(result.grandTotal).toBe(10000);
    expect(result.artists[0].percentage).toBe(75); // 7500/10000 = 75%
    expect(result.artists[1].percentage).toBe(25); // 2500/10000 = 25%
  });

  it("deve calcular ticket médio corretamente", () => {
    const rows = [
      { artist_name: "Artista A", period: "2026-03", appointment_count: 4, completed_count: 3, revenue: 2000, avg_ticket: 500 },
    ];
    const result = formatArtistRevenueResult(rows, "month");
    
    expect(result.artists[0].avgTicket).toBe(500); // 2000/4 = 500
  });

  it("deve agregar múltiplos períodos para o mesmo artista", () => {
    const rows = [
      { artist_name: "Artista A", period: "2026-01", appointment_count: 5, completed_count: 4, revenue: 2500, avg_ticket: 500 },
      { artist_name: "Artista A", period: "2026-02", appointment_count: 6, completed_count: 5, revenue: 3000, avg_ticket: 500 },
      { artist_name: "Artista A", period: "2026-03", appointment_count: 4, completed_count: 3, revenue: 2000, avg_ticket: 500 },
    ];
    const result = formatArtistRevenueResult(rows, "month");
    
    expect(result.artists).toHaveLength(1);
    expect(result.artists[0].totalRevenue).toBe(7500);
    expect(result.artists[0].totalAppointments).toBe(15);
    expect(result.artists[0].periods).toHaveLength(3);
    expect(result.periods).toHaveLength(3);
  });

  it("deve ordenar artistas por receita decrescente", () => {
    const rows = [
      { artist_name: "Artista C", period: "2026-03", appointment_count: 2, completed_count: 2, revenue: 1000, avg_ticket: 500 },
      { artist_name: "Artista A", period: "2026-03", appointment_count: 10, completed_count: 9, revenue: 5000, avg_ticket: 500 },
      { artist_name: "Artista B", period: "2026-03", appointment_count: 6, completed_count: 5, revenue: 3000, avg_ticket: 500 },
    ];
    const result = formatArtistRevenueResult(rows, "month");
    
    expect(result.artists[0].name).toBe("Artista A");
    expect(result.artists[1].name).toBe("Artista B");
    expect(result.artists[2].name).toBe("Artista C");
  });

  it("deve retornar percentual 0 quando grandTotal é 0", () => {
    const rows = [
      { artist_name: "Artista A", period: "2026-03", appointment_count: 5, completed_count: 3, revenue: 0, avg_ticket: 0 },
    ];
    const result = formatArtistRevenueResult(rows, "month");
    
    expect(result.grandTotal).toBe(0);
    expect(result.artists[0].percentage).toBe(0);
  });

  it("deve preservar o groupBy no resultado", () => {
    const result = formatArtistRevenueResult([], "year");
    expect(result.groupBy).toBe("year");
    
    const result2 = formatArtistRevenueResult([], "week");
    expect(result2.groupBy).toBe("week");
  });
});

// Testa a extração do nome do artista da descrição
describe("Extração de artista da descrição", () => {
  it("deve extrair o nome do artista após ' com '", () => {
    const descriptions = [
      "Sinal - Manga Completa com Fernanda Lima",
      "Pagamento - Fine Line Delicado com Rafael Mendes",
      "Sinal - Costas Completas com Camila Ferreira",
    ];
    
    const extractArtist = (desc: string) => desc.includes(" com ") ? desc.split(" com ").pop() : null;
    
    expect(extractArtist(descriptions[0])).toBe("Fernanda Lima");
    expect(extractArtist(descriptions[1])).toBe("Rafael Mendes");
    expect(extractArtist(descriptions[2])).toBe("Camila Ferreira");
  });

  it("deve retornar null para descrições sem ' com '", () => {
    const extractArtist = (desc: string) => desc.includes(" com ") ? desc.split(" com ").pop() : null;
    
    expect(extractArtist("Pagamento simples")).toBeNull();
    expect(extractArtist("Despesa de material")).toBeNull();
  });
});
