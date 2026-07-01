import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import * as sheetsLib from "./google-sheets";
import { StudentProfile } from "@/types/student-profile";
import { Reservation } from "@/types/reservation";

/**
 * Google Sheets 連携用の tRPC ルーター
 */
export const sheetsRouter = router({
  /**
   * 新しいスプレッドシートを作成
   */
  createSpreadsheet: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const spreadsheetId = await sheetsLib.createSpreadsheet(input.title);
        const url = sheetsLib.getSpreadsheetUrl(spreadsheetId);
        return {
          success: true,
          spreadsheetId,
          url,
        };
      } catch (error) {
        console.error("[Google Sheets] Failed to create spreadsheet:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * 学生プロフィールを書き込む
   */
  writeStudentProfile: publicProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        profile: z.object({
          id: z.string(),
          name: z.string(),
          category: z.string(),
          studentId: z.string().optional(),
          phone: z.string(),
          email: z.string(),
          createdAt: z.string(),
        }) as z.ZodType<StudentProfile>,
      })
    )
    .mutation(async ({ input }) => {
      try {
        await sheetsLib.writeStudentProfile(input.spreadsheetId, input.profile);
        return {
          success: true,
        };
      } catch (error) {
        console.error("[Google Sheets] Failed to write student profile:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * 予約を追記する
   */
  appendReservation: publicProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        reservation: z.object({
          id: z.string(),
          studentName: z.string(),
          grade: z.string(),
          pickupDate: z.string(),
          orderItems: z.array(
            z.object({
              menuId: z.string(),
              menuName: z.string(),
              price: z.number(),
              quantity: z.number(),
            })
          ),
          totalPrice: z.number(),
          notes: z.string().optional(),
          createdAt: z.string(),
          status: z.enum(["confirmed", "cancelled", "picked_up"]),
          paymentStatus: z.enum(["unpaid", "paid"]).optional().default("unpaid"),
        }) as z.ZodType<Reservation>,
      })
    )
    .mutation(async ({ input }) => {
      try {
        await sheetsLib.appendReservation(input.spreadsheetId, input.reservation);
        return {
          success: true,
        };
      } catch (error) {
        console.error("[Google Sheets] Failed to append reservation:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * スプレッドシート URL を取得
   */
  getSpreadsheetUrl: publicProcedure
    .input(z.object({ spreadsheetId: z.string() }))
    .query(({ input }) => {
      return {
        url: sheetsLib.getSpreadsheetUrl(input.spreadsheetId),
      };
    }),


  /**
   * 集計シートを作成・初期化する
   */
  createSummarySheet: publicProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        menuItems: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            price: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await sheetsLib.createSummarySheet(input.spreadsheetId, input.menuItems);
        return {
          success: true,
        };
      } catch (error) {
        console.error("[Google Sheets] Failed to create summary sheet:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * 集計シートを更新する
   */
  updateSummarySheet: publicProcedure
    .input(
      z.object({
        spreadsheetId: z.string(),
        reservation: z.object({
          id: z.string(),
          studentName: z.string(),
          grade: z.string(),
          pickupDate: z.string(),
          orderItems: z.array(
            z.object({
              menuId: z.string(),
              menuName: z.string(),
              price: z.number(),
              quantity: z.number(),
            })
          ),
          totalPrice: z.number(),
          notes: z.string().optional(),
          createdAt: z.string(),
          status: z.enum(["confirmed", "cancelled", "picked_up"]),
          paymentStatus: z.enum(["unpaid", "paid"]).optional().default("unpaid"),
        }) as z.ZodType<Reservation>,
      })
    )
    .mutation(async ({ input }) => {
      try {
        await sheetsLib.updateSummarySheet(input.spreadsheetId, input.reservation);
        return {
          success: true,
        };
      } catch (error) {
        console.error("[Google Sheets] Failed to update summary sheet:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
});

