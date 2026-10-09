"use client";
import { MessageCircle } from "lucide-react";
import { waMeUrl } from "@/lib/whatsapp-link";
import { trackEvent } from "@/components/consent/Analytics";
import { cn } from "@/lib/cn";

export function WhatsAppLink({ phone, message, className, reference, label = "Falar no WhatsApp" }: { phone: string; message: string; className?: string; reference?: string; label?: string }) {
  return (
    <a
      href={waMeUrl(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("btn btn-whatsapp", className)}
      onClick={() => trackEvent("whatsapp_click", reference ? { vehicle_reference: reference } : {})}
    >
      <MessageCircle aria-hidden className="h-4 w-4" />
      {label}
    </a>
  );
}
