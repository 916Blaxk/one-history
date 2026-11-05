'use client';
import { useEffect } from 'react';

/* Guarda a página pedida, para um convite aberto sem login continuar de onde parou. */
export default function IrParaEntrar() {
  useEffect(() => {
    window.location.replace(`/entrar?destino=${encodeURIComponent(window.location.pathname)}`);
  }, []);
  return <p className="folio apagado">Abrindo a tela de entrada…</p>;
}
