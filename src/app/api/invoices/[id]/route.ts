import { NextRequest, NextResponse } from 'next/server';
import {
  readInvoicesFromCSV,
  writeInvoicesToCSV,
  validateEditInput,
  updateInvoice,
  syncInvoicesToGit,
} from '@/lib/invoices-server';
import { InvoiceEditInput } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invoices/[id]
 * Retorna una factura específica
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const invoices = await readInvoicesFromCSV();
    const invoice = invoices.find((inv) => inv.invoice_id === id);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Error reading invoice:', error);
    return NextResponse.json(
      { error: 'Error al leer factura' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/invoices/[id]
 * Edita una factura (todos los campos editables)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Bloquear ediciones en Vercel (producción)
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: 'Las ediciones solo están disponibles en el entorno local. Edita en desarrollo y despliega a Vercel.' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const input: InvoiceEditInput = await request.json();

    // 1. Validar input
    const errors = validateEditInput(input);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: 'Errores de validación', errors },
        { status: 400 }
      );
    }

    // 2. Leer facturas y encontrar la que se edita
    const invoices = await readInvoicesFromCSV();
    const index = invoices.findIndex((inv) => inv.invoice_id === id);

    if (index === -1) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      );
    }

    // 3. Actualizar factura (todos los campos)
    const updatedInvoice = updateInvoice(invoices[index], input);
    invoices[index] = updatedInvoice;

    // 4. Guardar (con backup + atomic write)
    await writeInvoicesToCSV(invoices);

    // 5. Auto-sync a git+Vercel (fire-and-forget, solo en local)
    syncInvoicesToGit(`editar ${id}`).catch(() => {});

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error('Error updating invoice:', error);

    if (error instanceof Error && error.message.includes('escritura')) {
      return NextResponse.json(
        { error: error.message },
        { status: 423 } // Locked
      );
    }

    return NextResponse.json(
      { error: 'Error al actualizar factura' },
      { status: 500 }
    );
  }
}
