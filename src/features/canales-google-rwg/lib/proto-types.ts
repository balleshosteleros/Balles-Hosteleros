/**
 * Tipos del contrato Reservations End-to-End del Actions Center.
 * Versión mínima v1: se irá completando en Fases 3-5.
 * Ref: https://developers.google.com/actions-center/verticals/reservations/e2e
 */

// ---------- Comunes ----------
export interface SlotTime {
  merchant_id: string;
  service_id: string;
  start_sec: number;             // unix seconds
  duration_sec?: number;
  resources?: { party_size?: number; room_id?: string };
  availability_tag?: string;     // token opaco que Google reenvía en CreateBooking
  confirmation_mode?: "CONFIRMATION_MODE_SYNCHRONOUS" | "CONFIRMATION_MODE_ASYNCHRONOUS";
}

export interface UserInformation {
  user_id?: string;
  given_name?: string;
  family_name?: string;
  telephone?: string;
  email?: string;
  language_code?: string;
}

// ---------- HealthCheck ----------
export type HealthCheckRequest = Record<string, never>;
export interface HealthCheckResponse {
  operation_succeeded: boolean;
}

// ---------- BatchAvailabilityLookup ----------
export interface BatchAvailabilityLookupRequest {
  merchant_id: string;
  slot_time: Array<{
    service_id: string;
    start_sec: number;
    duration_sec?: number;
    resources?: { party_size?: number };
  }>;
}

export type SpotsAvailability =
  | "SPOTS_AVAILABILITY_UNSPECIFIED"
  | "SPOTS_AVAILABILITY_AVAILABLE"
  | "SPOTS_AVAILABILITY_UNAVAILABLE";

export interface SlotTimeAvailability {
  slot_time: BatchAvailabilityLookupRequest["slot_time"][number];
  spots_open: number;
  spots_total: number;
  availability_tag?: string;
  availability: SpotsAvailability;
}

export interface BatchAvailabilityLookupResponse {
  slot_time_availability: SlotTimeAvailability[];
}

// ---------- CreateBooking ----------
export interface CreateBookingRequest {
  idempotency_token: string;
  slot: SlotTime;
  user_information: UserInformation;
  notes?: string;
  marketing_opt_in?: boolean;
  party_size?: number;
}

export type BookingStatus =
  | "CONFIRMED"
  | "PENDING_MERCHANT_CONFIRMATION"
  | "PENDING_CLIENT_CONFIRMATION"
  | "CANCELED"
  | "NO_SHOW";

export type BookingFailureReason =
  | "BOOKING_FAILURE_REASON_UNSPECIFIED"
  | "SLOT_UNAVAILABLE"
  | "PAYMENT_ERROR"
  | "USER_OVER_BOOKING_LIMIT"
  | "PAYMENT_REQUIRED"
  | "MERCHANT_BLOCKED_USER";

export interface Booking {
  booking_id: string;            // uuid de reservas.id
  merchant_id: string;
  service_id: string;
  start_sec: number;
  duration_sec?: number;
  status: BookingStatus;
  party_size?: number;
  user_information: UserInformation;
}

export interface CreateBookingResponse {
  booking?: Booking;
  booking_failure?: {
    cause: BookingFailureReason;
    description?: string;
  };
  user_payment_option_id?: string;
}

// ---------- UpdateBooking ----------
export interface UpdateBookingRequest {
  booking: Pick<Booking, "booking_id" | "status"> &
    Partial<Pick<Booking, "start_sec" | "duration_sec" | "party_size">>;
  update_mask?: string;          // p.ej. "status,start_sec"
}

export interface UpdateBookingResponse {
  booking?: Booking;
  booking_failure?: CreateBookingResponse["booking_failure"];
}

// ---------- SetMarketingPreference ----------
export interface SetMarketingPreferenceRequest {
  user_information: UserInformation;
  merchant_id: string;
  is_opted_in: boolean;
}

export type SetMarketingPreferenceResponse = Record<string, never>;

// ---------- Util ----------
export const RWG_EXTERNAL_ORIGEN = "GOOGLE_RWG" as const;
export const RWG_ORIGEN_CANONICO = "GOOGLE" as const;
