"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";

// Dummy data for the chart
const chartData = [
  { month: "Jan", value: 4000 },
  { month: "Feb", value: 3000 },
  { month: "Mar", value: 5000 },
  { month: "Apr", value: 4500 },
  { month: "May", value: 6000 },
  { month: "Jun", value: 5500 },
];

export default function NotFound() {
  const [animationState, setAnimationState] = useState<
    "loading" | "failed" | "complete"
  >("loading");

  useEffect(() => {
    // Show loading for 1.5s, then fail
    const timer1 = setTimeout(() => {
      setAnimationState("failed");
    }, 1500);

    // Show 404 animation after failure
    const timer2 = setTimeout(() => {
      setAnimationState("complete");
    }, 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-4xl">
        {/* Chart Container */}
        <div className="relative mb-12 h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis
                dataKey="month"
                stroke="#6b7280"
                style={{ fontSize: "14px" }}
              />
              <YAxis stroke="#6b7280" style={{ fontSize: "14px" }} />
              <AnimatePresence>
                {animationState === "loading" && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#9ca3af"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={true}
                      animationDuration={1200}
                    />
                  </motion.g>
                )}
              </AnimatePresence>
            </LineChart>
          </ResponsiveContainer>

          {/* 404 Text Animation */}
          <AnimatePresence>
            {animationState !== "loading" && (
              <motion.div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                initial={{ y: 150, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  ease: [0.34, 1.56, 0.64, 1],
                  delay: 0.1,
                }}
              >
                <div className="text-center">
                  <h1 className="mb-4 text-[160px] leading-none font-bold text-[#1a1a1a]">
                    404
                  </h1>
                  <motion.p
                    className="text-xl text-[#404040]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.7 }}
                  >
                    Page not found
                  </motion.p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Message */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => (window.location.href = "/")}
              className="bg-[#1a1a1a] text-white hover:bg-[#404040]"
            >
              Return Home
            </Button>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="border-[#404040] text-[#404040] hover:bg-[#f5f5f5]"
            >
              Go Back
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
