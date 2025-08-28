"use server";

async function getSeries() {
  const series = await fetch("http://127.0.0.1:3001/series");
  if (series) {
    return series.json();
  }
  return { status: 400, message: "failed" };
}

export { getSeries };
