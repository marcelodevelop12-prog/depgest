import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(d)
}

export function formatCpfCnpj(v: string): string {
  const digits = v.replace(/\D/g, '')
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    novo: 'Novo', separando: 'Separando', a_caminho: 'A Caminho',
    entregue: 'Entregue', cancelado: 'Cancelado',
  }
  return labels[status] || status
}

export function whatsappUrl(telefone: string | null | undefined, mensagem: string): string {
  if (!telefone) return '#'
  const num = telefone.replace(/\D/g, '')
  const numBr = num.startsWith('55') ? num : `55${num}`
  return `https://wa.me/${numBr}?text=${encodeURIComponent(mensagem)}`
}

export function gerarLinkRastreio(token: string): string {
  return `${import.meta.env.VITE_RASTREIO_URL || 'https://vercel-app-lime-alpha.vercel.app'}/rastreio/${token}`
}

declare global {
  interface Window {
    api: import('../types/electron').ElectronAPI
  }
}
