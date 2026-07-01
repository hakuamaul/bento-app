import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { StudentProfile } from "@/types/student-profile";
import { Reservation } from "@/types/reservation";

export interface GoogleSheetsState {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Google Sheets 連携フック
 * スプレッドシートの作成、データの書き込み、URL の取得を管理
 */
export function useGoogleSheets() {
  const [state, setState] = useState<GoogleSheetsState>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    loading: false,
    error: null,
  });

  // tRPC ミューテーション
  const createSpreadsheetMutation = trpc.sheets.createSpreadsheet.useMutation();
  const writeStudentProfileMutation =
    trpc.sheets.writeStudentProfile.useMutation();
  const appendReservationMutation = trpc.sheets.appendReservation.useMutation();
  const getSpreadsheetUrlQuery = trpc.sheets.getSpreadsheetUrl.useQuery;

  const createSpreadsheet = useCallback(
    async (title: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await createSpreadsheetMutation.mutateAsync({ title });
        if (result.success) {
          setState({
            spreadsheetId: result.spreadsheetId || null,
            spreadsheetUrl: result.url || null,
            loading: false,
            error: null,
          });
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result.error || "Failed to create spreadsheet",
          }));
          return false;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        return false;
      }
    },
    [createSpreadsheetMutation]
  );

  const writeStudentProfile = useCallback(
    async (profile: StudentProfile): Promise<boolean> => {
      if (!state.spreadsheetId) {
        setState((prev) => ({
          ...prev,
          error: "Spreadsheet not created yet",
        }));
        return false;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await writeStudentProfileMutation.mutateAsync({
          spreadsheetId: state.spreadsheetId,
          profile,
        });
        if (result.success) {
          setState((prev) => ({ ...prev, loading: false, error: null }));
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result.error || "Failed to write student profile",
          }));
          return false;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        return false;
      }
    },
    [state.spreadsheetId, writeStudentProfileMutation]
  );

  const appendReservation = useCallback(
    async (reservation: Reservation): Promise<boolean> => {
      if (!state.spreadsheetId) {
        setState((prev) => ({
          ...prev,
          error: "Spreadsheet not created yet",
        }));
        return false;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await appendReservationMutation.mutateAsync({
          spreadsheetId: state.spreadsheetId,
          reservation,
        });
        if (result.success) {
          setState((prev) => ({ ...prev, loading: false, error: null }));
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: result.error || "Failed to append reservation",
          }));
          return false;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        return false;
      }
    },
    [state.spreadsheetId, appendReservationMutation]
  );

  const getSpreadsheetUrl = useCallback(
    async (spreadsheetId: string): Promise<string | null> => {
      try {
        // Note: useQuery は React hooks として使用する必要があるため、
        // 非同期関数内では使用できません。
        // 代わりに、状態から URL を取得するか、別の方法を使用してください。
        return state.spreadsheetUrl;
      } catch (error) {
        console.error("Failed to get spreadsheet URL:", error);
        return null;
      }
    },
    [state.spreadsheetUrl]
  );

  return {
    state,
    createSpreadsheet,
    writeStudentProfile,
    appendReservation,
    getSpreadsheetUrl,
  };
}
