import { Request, Response } from "express";
import WaitlistUsers from "../models/WaitlistUsers.js";

const DAYS_WINDOW = 7;

interface DailyAggResult {
  _id: string;
  count: number;
}

interface DailySeriesRow {
  date: string;
  count: number;
}

const startOfUTCDay = (date: Date): Date => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const toISODate = (date: Date): string => date.toISOString().slice(0, 10);

const buildEmptyDailySeries = (days: number): DailySeriesRow[] => {
  const today = startOfUTCDay(new Date());
  const series: DailySeriesRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    series.push({ date: toISODate(d), count: 0 });
  }
  return series;
};

export const getStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = startOfUTCDay(new Date());
    const windowStart = new Date(today);
    windowStart.setUTCDate(windowStart.getUTCDate() - (DAYS_WINDOW - 1));

    const [waitlistedUsers, dailyAgg] = await Promise.all([
      WaitlistUsers.countDocuments({}),
      WaitlistUsers.aggregate<DailyAggResult>([
        { $match: { createdAt: { $gte: windowStart } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const aggByDate = new Map(dailyAgg.map((row) => [row._id, row.count]));
    const dailyUserCounts = buildEmptyDailySeries(DAYS_WINDOW).map((row) => ({
      date: row.date,
      count: aggByDate.get(row.date) ?? 0,
    }));

    res.json({
      data: {
        totalUsers: waitlistedUsers,
        waitlistedUsers,
        totalPlaces: 0,
        servicesHealth: "healthy",
        dailyUserCounts,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Server error" });
  }
};
