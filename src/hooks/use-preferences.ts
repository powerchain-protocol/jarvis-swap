"use client";
import { useCallback, useEffect, useState } from "react";
import { readPreferences, writePreferences } from "@/services/preferences/preferences";
import type { UserPreferences } from "@/types/preferences";
export function usePreferences(){ const [preferences,setState]=useState<UserPreferences>(()=>readPreferences()); useEffect(()=>{const f=()=>setState(readPreferences()); addEventListener("storage",f); addEventListener("jarvis-swap:preferences",f as EventListener); return()=>{removeEventListener("storage",f);removeEventListener("jarvis-swap:preferences",f as EventListener)}},[]); const setPreferences=useCallback((patch:Partial<UserPreferences>)=>setState(prev=>writePreferences({...prev,...patch})),[]); return {preferences,setPreferences}; }
