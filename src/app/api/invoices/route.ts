import { NextRequest, NextResponse } from 'next/server';
import {
  readInvoicesFromCSV,
  writeInvoicesToCSV,
  validateCreateInput,
  enrichInvoice,
  invoiceIdExists,
  getUniqueCustomers,
} from '@/lib/invoices-server';
import { InvoiceCreateInput } from '@/types';

/**
 * GET /api/invoices
 * Retorna todas las facturas + lista de clientes únicos
 */
export async function GET() {
  try {
    const [invoices, customers] = await Promise.all([
      readInvoicesFromCSV(),
      getUniqueCustomers(),
    ]);

    return NextResponse.json({
      invoices,
      customers,
    });
  } catch (error) {
    console.error('Error reading invoices:', error);
    return NextResponse.json(
      { error: 'Error al leer facturas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices
 * Crea una nueva factura
 */
export async function POST(request: NextRequest) {
  try {
    const input: InvoiceCreateInput = await request.json();

    // 1. Validar input
    const errors = validateCreateInput(input);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: 'Errores de validación', errors },
        { status: 400 }
      );
    }

    // 2. Verificar que invoice_id no exista
    const exists = await invoiceIdExists(input.invoice_id);
    if (exists) {
      return NextResponse.json(
        {
          error: 'Errores de validación',
          errors: { invoice_id: 'Ya existe una factura con este ID' },
        },
        { status: 400 }
      );
    }

    // 3. Enriquecer con campos derivados
    const newInvoice = enrichInvoice(input);

    // 4. Leer facturas existentes y añadir la nueva
    const invoices = await readInvoicesFromCSV();
    invoices.push(newInvoice);

    // 5. Guardar (con backup + atomic write)
    await writeInvoicesToCSV(invoices);

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);

    if (error instanceof Error && error.message.includes('escritura')) {
      return NextResponse.json(
        { error: error.message },
        { status: 423 } // Locked
      );
    }

    return NextResponse.json(
      { error: 'Error al crear factura' },
      { status: 500 }
    );
  }
}
