import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
    format, addDays, startOfWeek, addMinutes, isSameDay, parseISO,
    getHours, getMinutes, setHours, setMinutes, differenceInMinutes,
    startOfDay, endOfDay, parse, startOfMinute, isToday,
    isWithinInterval, isBefore, isValid
} from 'date-fns';
import {
    ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
    Clock, User as UserIcon, MapPin, GripVertical, X,
    Ban, Trash, Loader2, Edit2, RefreshCw, Menu as MenuIcon, Search, Check, UserPlus, DollarSign
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { supabase } from '@/lib/customSupabaseClient';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/components/ui/use-toast';
import { useShop } from '@/contexts/ShopContext';
import { Badge } from '@/components/ui/badge';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import { cn } from '@/lib/utils';

const CalendarPage = () => {
    const { toast } = useToast();
    const { showDialog } = useAlertDialog();
    const { currentShop, shops, setCurrentShop, loading: shopLoading } = useShop();

    // Debug: Log shops when they change
    useEffect(() => {
        console.log('Calendar: Shops updated:', shops.length, shops);
        console.log('Calendar: Current shop:', currentShop);
        if (currentShop) {
            console.log('Calendar: Shop opening time:', currentShop.opening_time, 'closing time:', currentShop.closing_time);
        }
    }, [shops, currentShop]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [services, setServices] = useState([]);
    const [clients, setClients] = useState([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Dialog states
    const [appointmentType, setAppointmentType] = useState('appointment');
    const [editingAppointment, setEditingAppointment] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [clientSearchOpen, setClientSearchOpen] = useState(false);
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [hoveredAppointment, setHoveredAppointment] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [hoveredTeamMember, setHoveredTeamMember] = useState(null);
    const [teamMemberTooltipPosition, setTeamMemberTooltipPosition] = useState({ x: 0, y: 0 });
    const [isCreatingClientLoading, setIsCreatingClientLoading] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: '', phone: '', email: '' });

    // Form states
    const [formData, setFormData] = useState({
        client_id: '',
        service_id: '',
        team_member_id: '',
        date: new Date(),
        start_time: '09:00',
        end_time: '10:00',
        duration: 60,
        notes: '',
        type: 'appointment',
        reason: '',
        client_name: '',
        client_phone: ''
    });

    const [currentTime, setCurrentTime] = useState(new Date());
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [draggedAppointment, setDraggedAppointment] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null);
    const [dragPosition, setDragPosition] = useState(null); // Store precise drag position { member, time, offsetY }
    const [dragClickOffset, setDragClickOffset] = useState(0); // Store Y offset from top of appointment where user clicked
    const calendarGridRef = useRef(null);
    const lastAutoUpdatePosition = useRef(null); // Track last auto-updated position to prevent duplicate updates
    const isAutoUpdating = useRef(false); // Prevent concurrent auto-updates
    const originalAppointmentPosition = useRef(null); // Store original position when drag starts for reverting on overlap
    const SLOT_DURATION_MINUTES = 30;
    const SLOT_HEIGHT = 60;

    // Calculate start and end hours from shop's opening/closing times
    const { START_HOUR, END_HOUR } = useMemo(() => {
        if (!currentShop) {
            // Default values if no shop is selected
            return { START_HOUR: 8, END_HOUR: 20 };
        }

        // Parse opening_time and closing_time (format: HH:MM:SS or HH:MM)
        // Parse opening_time and closing_time (format: HH:MM:SS or HH:MM)
        const parseTime = (timeString) => {
            if (!timeString) return { hour: 8, minute: 0 };
            const parts = timeString.split(':');
            return {
                hour: parseInt(parts[0], 10) || 8,
                minute: parseInt(parts[1], 10) || 0
            };
        };

        const opening = parseTime(currentShop.opening_time);
        const closing = parseTime(currentShop.closing_time);

        // Calculate hours
        // Start hour should be the hour of opening time
        let startHour = opening.hour;

        // End hour should be rounded up if there are minutes in closing time
        // e.g., 20:30 -> 21:00 to show the 20:30 slot
        let endHour = closing.hour;
        if (closing.minute > 0) {
            endHour += 1;
        }

        // Ensure valid range (0-23)
        startHour = Math.max(0, Math.min(23, startHour));
        endHour = Math.max(startHour + 1, Math.min(24, endHour)); // Allow up to 24 for end hour

        console.log(`Calendar: calculated hours - Opening: ${opening.hour}:${opening.minute}, Closing: ${closing.hour}:${closing.minute}, Display: ${startHour}:00 - ${endHour}:00`);

        return { START_HOUR: startHour, END_HOUR: endHour };
    }, [currentShop]);

    // Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Generate time intervals for dropdowns
    const generateTimeIntervals = useCallback((intervalMinutes = 15) => {
        const intervals = [];
        for (let h = START_HOUR; h < END_HOUR; h++) {
            for (let m = 0; m < 60; m += intervalMinutes) {
                intervals.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        }
        // Add absolute last time if it aligns exactly with END_HOUR and no minutes over
        intervals.push(`${String(END_HOUR).padStart(2, '0')}:00`);
        return intervals;
    }, [START_HOUR, END_HOUR]);

    // Time slots for grid display
    const timeSlotsForGrid = useMemo(() => {
        const slots = [];
        const totalMinutes = (END_HOUR - START_HOUR) * 60;
        const slotsCount = totalMinutes / SLOT_DURATION_MINUTES;

        for (let i = 0; i < slotsCount; i++) {
            const minutesFromStart = i * SLOT_DURATION_MINUTES;
            const hour = START_HOUR + Math.floor(minutesFromStart / 60);
            const minute = minutesFromStart % 60;

            // Don't generate slots that start at or after the closing time
            // Need to retrieve actual closing info again or pass it through
            // For now, simpler check: if we are at the last slot, ensure we don't exceed visual bounds
            slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
        }
        return slots;
    }, [START_HOUR, END_HOUR, SLOT_DURATION_MINUTES]);

    const fullTimeSlots = useMemo(() => generateTimeIntervals(15), [generateTimeIntervals]);

    const fetchData = useCallback(async (silent = false) => {
        if (!currentShop) {
            console.log("Calendar: No current shop selected");
            if (!silent) {
                setLoading(false);
            }
            return;
        }

        console.log("Calendar: Fetching data for shop:", currentShop.id, currentShop.name);
        if (!silent) {
            setLoading(true);
        }

        try {
            const from = startOfDay(selectedDate).toISOString();
            const to = endOfDay(selectedDate).toISOString();

            // 1. Get appointments for selected date and current shop
            const { data: appointmentsData, error: appointmentsError } = await supabase
                .from('appointments')
                .select(`
                    *,
                    services ( id, name, duration, buffer_time, price ),
                    team_members ( id, name, image_url ),
                    clients ( id, name, phone )
                `)
                .eq('shop_id', currentShop.id)
                .gte('start_time', from)
                .lte('start_time', to);

            if (appointmentsError) {
                console.error("Error fetching appointments:", appointmentsError);
                throw appointmentsError;
            }
            setAppointments(appointmentsData || []);
            console.log("Calendar: Loaded", appointmentsData?.length || 0, "appointments");

            // 2. Get team members assigned to the current shop
            let membersData = [];
            const { data: shopMembersData, error: membersError } = await supabase
                .from('team_member_shops')
                .select(`
                    team_member_id,
                    team_members (
                        id,
                        name,
                        email,
                        phone,
                        image_url,
                        working_days,
                        employment_status_id,
                        job_title,
                        description,
                        default_hourly_rate,
                        commission_percentage
                    )
                `)
                .eq('shop_id', currentShop.id);

            if (membersError) {
                console.error("Error fetching team members from team_member_shops:", membersError);
                // If error, try to get team members directly by shop_id
                console.log("Calendar: Trying fallback - fetching team members by shop_id");
                const { data: allMembersData, error: allMembersError } = await supabase
                    .from('team_members')
                    .select('*')
                    .eq('shop_id', currentShop.id)
                    .order('name');

                if (allMembersError) {
                    console.error("Error fetching team members by shop_id:", allMembersError);
                    // Last resort: get all team members (might be empty if shop_id is required)
                    const { data: lastResortData, error: lastResortError } = await supabase
                        .from('team_members')
                        .select('*')
                        .order('name');

                    if (lastResortError) {
                        console.error("Error fetching all team members (last resort):", lastResortError);
                        throw lastResortError;
                    }
                    membersData = lastResortData || [];
                    console.log("Calendar: Last resort - Loaded", membersData.length, "team members (all, no shop filter)");
                } else {
                    membersData = allMembersData || [];
                    console.log("Calendar: Fallback - Loaded", membersData.length, "team members by shop_id");
                }
            } else {
                // Extract team members from the nested structure
                const members = (shopMembersData || [])
                    .map(item => item.team_members)
                    .filter(Boolean) // Remove any null/undefined entries
                    .filter((member, index, self) =>
                        // Remove duplicates (in case of data inconsistency)
                        index === self.findIndex(m => m.id === member.id)
                    )
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                membersData = members;
                console.log("Calendar: Loaded", membersData.length, "team members assigned to shop");

                // If no members assigned to shop, try to get team members directly by shop_id
                if (membersData.length === 0) {
                    console.log("Calendar: No members in junction table, fetching team members by shop_id");
                    const { data: directMembersData, error: directError } = await supabase
                        .from('team_members')
                        .select('*')
                        .eq('shop_id', currentShop.id)
                        .order('name');

                    if (directError) {
                        console.error("Error fetching team members by shop_id:", directError);
                        // Last resort: try without shop_id filter (for backward compatibility)
                        const { data: lastResortData, error: lastResortError } = await supabase
                            .from('team_members')
                            .select('*')
                            .order('name');

                        if (lastResortError) {
                            console.error("Error fetching all team members (last resort):", lastResortError);
                        } else {
                            membersData = lastResortData || [];
                            console.log("Calendar: Last resort - Loaded", membersData.length, "team members (all, no shop filter)");
                        }
                    } else {
                        membersData = directMembersData || [];
                        console.log("Calendar: Loaded", membersData.length, "team members directly by shop_id");
                    }
                }
            }

            setTeamMembers(membersData);
            console.log("Calendar: Total team members set:", membersData.length);

            // Filter team members by working days (will be done in useMemo below)

            // 3. Get services and clients for current shop
            const [servicesRes, clientsRes] = await Promise.all([
                supabase.from('services').select('*').eq('shop_id', currentShop.id),
                supabase.from('clients').select('*').eq('shop_id', currentShop.id)
            ]);

            if (servicesRes.error) {
                console.error("Error fetching services:", servicesRes.error);
            } else {
                setServices(servicesRes.data || []);
                console.log("Calendar: Loaded", servicesRes.data?.length || 0, "services");
            }

            if (clientsRes.error) {
                console.error("Error fetching clients:", clientsRes.error);
            } else {
                setClients(clientsRes.data || []);
                console.log("Calendar: Loaded", clientsRes.data?.length || 0, "clients");
            }

        } catch (error) {
            console.error("Error fetching calendar data:", error);
            if (!silent) {
                toast({ variant: "destructive", title: "Error loading calendar", description: error.message });
            }
            setTeamMembers([]);
            setAppointments([]);
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [selectedDate, currentShop, toast]);

    useEffect(() => {
        // Wait for shops to finish loading, then fetch data if we have a shop
        if (!shopLoading) {
            if (currentShop) {
                console.log('Calendar: Shop loaded, fetching data for:', currentShop.name);
                fetchData();
            } else {
                console.log('Calendar: No shop available after loading');
                setLoading(false);
            }
        }
    }, [selectedDate, currentShop, shopLoading, fetchData]);

    // Filter team members based on working days for the selected date
    const filteredTeamMembers = useMemo(() => {
        if (!teamMembers || teamMembers.length === 0) {
            return [];
        }

        // Get the day name for the selected date (e.g., "Monday", "Tuesday")
        const selectedDayName = format(selectedDate, 'EEEE');

        // Filter team members who work on the selected day
        const filtered = teamMembers.filter(member => {
            // If member has no working_days set or empty array, don't show them
            if (!member.working_days || member.working_days.length === 0) {
                return false;
            }

            // Handle both array and string formats
            let workingDays = member.working_days;
            if (typeof workingDays === 'string') {
                // If it's a string, split by comma and trim, filter out empty strings
                workingDays = workingDays.split(',').map(day => day.trim()).filter(day => day.length > 0);
                // If after processing the string, we have no valid days, don't show
                if (workingDays.length === 0) {
                    return false;
                }
            }

            // Check if the selected day is in the working days
            return Array.isArray(workingDays) && workingDays.includes(selectedDayName);
        });

        console.log(`Calendar: Filtered team members for ${selectedDayName}:`, filtered.length, 'out of', teamMembers.length);
        return filtered;
    }, [teamMembers, selectedDate]);

    // Focus the command input when the popover opens
    useEffect(() => {
        if (clientSearchOpen) {
            // Reset search query when opening
            setClientSearchQuery('');
            // Small delay to ensure the popover is fully rendered
            setTimeout(() => {
                const input = document.querySelector('[cmdk-input]');
                if (input && document.activeElement !== input) {
                    input.focus();
                    // Ensure input is interactive
                    if (input instanceof HTMLInputElement) {
                        input.select();
                    }
                }
            }, 200);
        }
    }, [clientSearchOpen]);

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (isDialogOpen) {
            if (selectedSlot) {
                setFormData({
                    ...formData,
                    team_member_id: selectedSlot.member.id,
                    date: selectedSlot.date,
                    start_time: selectedSlot.time,
                    end_time: '', // End time will be calculated from service duration
                    type: 'appointment'
                });
            } else if (editingAppointment) {
                const aptStart = parseISO(editingAppointment.start_time);
                const aptEnd = parseISO(editingAppointment.end_time);
                setFormData({
                    client_id: editingAppointment.client_id || '',
                    service_id: editingAppointment.service_id || '',
                    team_member_id: editingAppointment.team_member_id,
                    date: aptStart,
                    start_time: format(aptStart, 'HH:mm'),
                    end_time: format(aptEnd, 'HH:mm'),
                    duration: differenceInMinutes(aptEnd, aptStart),
                    notes: editingAppointment.reason || '',
                    type: editingAppointment.type,
                    reason: editingAppointment.reason || '',
                    client_name: editingAppointment.client_name || '',
                    client_phone: editingAppointment.client_phone || ''
                });
                setAppointmentType(editingAppointment.type);
            }
        } else {
            resetForm();
        }
    }, [isDialogOpen, selectedSlot, editingAppointment]);

    const resetForm = () => {
        setFormData({
            client_id: '',
            service_id: '',
            team_member_id: '',
            date: new Date(),
            start_time: '09:00',
            end_time: '10:00',
            duration: 60,
            notes: '',
            type: 'appointment',
            reason: '',
            client_name: '',
            client_phone: ''
        });
        setClientSearchOpen(false);
        setNewClientData({ name: '', phone: '', email: '' });
        setAppointmentType('appointment');
        setSelectedSlot(null);
        setEditingAppointment(null);
        setIsSaving(false);
    };

    // Check if a time slot is in the past
    const isSlotInPast = useCallback((time) => {
        const slotTime = parse(time, 'HH:mm', selectedDate);
        const now = new Date();

        // If selected date is in the past, all slots are disabled
        if (isBefore(selectedDate, startOfDay(now))) {
            return true;
        }

        // If selected date is today, check if the slot time is before current time
        if (isToday(selectedDate)) {
            return isBefore(slotTime, now);
        }

        return false;
    }, [selectedDate]);

    const handleSlotClick = (member, time) => {
        // Prevent clicking on past time slots
        if (isSlotInPast(time)) {
            toast({
                variant: 'destructive',
                title: 'Cannot Create Appointment',
                description: 'You cannot create appointments in the past.'
            });
            return;
        }

        setSelectedSlot({ member, date: selectedDate, time });
        setAppointmentType('appointment');
        setIsDialogOpen(true);
    };

    const handleAppointmentClick = (appointment) => {
        setEditingAppointment(appointment);
        setAppointmentType(appointment.type);
        setIsDialogOpen(true);
    };

    const handleDeleteBlockedTime = async (appointment, e) => {
        e.stopPropagation(); // Prevent opening the dialog

        showDialog({
            title: 'Unblock Time?',
            description: 'Are you sure you want to unblock this time slot? This action cannot be undone.',
            confirmText: 'Unblock',
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('appointments')
                        .delete()
                        .eq('id', appointment.id);

                    if (error) throw error;

                    toast({
                        title: 'Success!',
                        description: 'The time block has been removed.'
                    });

                    fetchData(true); // Silent refresh
                } catch (error) {
                    toast({ variant: "destructive", title: "Delete Failed", description: error.message });
                }
            },
        });
    };

    const handleCreateNewClient = async () => {
        if (!newClientData.name.trim()) {
            toast({ variant: "destructive", title: "Validation Error", description: "Client name is required." });
            return;
        }

        if (!currentShop) {
            toast({ variant: "destructive", title: "Error", description: "Please select a shop first." });
            return;
        }

        if (isCreatingClientLoading) return; // Prevent multiple submissions

        setIsCreatingClientLoading(true);
        try {
            const { data: newClient, error: clientError } = await supabase
                .from('clients')
                .insert({
                    name: newClientData.name.trim(),
                    phone: newClientData.phone.trim() || null,
                    email: newClientData.email.trim() || null,
                    shop_id: currentShop.id
                })
                .select()
                .single();

            if (clientError) throw clientError;

            // Refresh clients list for current shop
            const { data: updatedClients, error: fetchError } = await supabase
                .from('clients')
                .select('*')
                .eq('shop_id', currentShop.id)
                .order('name');

            if (!fetchError && updatedClients) {
                setClients(updatedClients);
            }

            // Set the newly created client as selected
            setFormData(prev => ({ ...prev, client_id: newClient.id }));

            // Reset form and close dialogs
            setNewClientData({ name: '', phone: '', email: '' });
            setIsCreatingClientLoading(false);
            setIsCreatingClient(false);
            setClientSearchOpen(false);

            toast({
                title: "Client Created! ✨",
                description: `${newClient.name} has been added successfully.`
            });
        } catch (error) {
            console.error('Error creating client:', error);
            toast({
                variant: "destructive",
                title: "Failed to Create Client",
                description: error.message || "There was an error creating the client."
            });
            setIsCreatingClientLoading(false);
        }
    };

    const handleSaveAppointment = async () => {
        if (!formData.team_member_id || !formData.start_time) {
            toast({ variant: "destructive", title: "Missing Information", description: "Please fill all required fields." });
            return;
        }

        if (appointmentType === 'appointment' && !formData.client_id) {
            toast({ variant: "destructive", title: "Missing Client", description: "Please select or create a client." });
            return;
        }

        if (appointmentType === 'appointment' && !formData.service_id) {
            toast({ variant: "destructive", title: "Missing Service", description: "Please select a service." });
            return;
        }

        // Validate time format
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(formData.start_time)) {
            toast({ variant: "destructive", title: "Invalid Start Time", description: "Please enter a valid time in HH:mm format (e.g., 09:30, 14:15)." });
            return;
        }

        // Ensure date is valid
        if (!formData.date || !isValid(formData.date)) {
            toast({ variant: "destructive", title: "Invalid Date", description: "Please select a valid date." });
            return;
        }

        setIsSaving(true);
        try {
            // Normalize time values (trim whitespace, ensure HH:mm format)
            const normalizedStartTime = formData.start_time.trim();

            // Parse start time - HTML5 time input returns HH:mm format
            let startDateTime, endDateTime;

            try {
                // Combine date and time
                const [startHour, startMin] = normalizedStartTime.split(':').map(Number);
                startDateTime = setMinutes(setHours(formData.date, startHour), startMin);

                if (!isValid(startDateTime)) {
                    throw new Error('Invalid start time');
                }
            } catch (error) {
                console.error('Error parsing start time:', error);
                toast({ variant: "destructive", title: "Invalid Start Time", description: `Please enter a valid start time. Error: ${error.message}` });
                setIsSaving(false);
                return;
            }

            // Calculate end time based on service duration + buffer time
            if (appointmentType === 'appointment' && formData.service_id) {
                const selectedService = services.find(s => s.id === formData.service_id);
                const serviceDuration = selectedService?.duration || 60; // Default to 60 minutes
                const bufferTime = selectedService?.buffer_time || 0;
                const totalDuration = serviceDuration + bufferTime;
                endDateTime = addMinutes(startDateTime, totalDuration);
            } else if (appointmentType === 'blocked') {
                // For blocked time, use the end_time from formData if available, otherwise default to 1 hour
                if (formData.end_time) {
                    const normalizedEndTime = formData.end_time.trim();
                    const [endHour, endMin] = normalizedEndTime.split(':').map(Number);
                    endDateTime = setMinutes(setHours(formData.date, endHour), endMin);
                } else {
                    // Default to 1 hour for blocked time if no end time specified
                    endDateTime = addMinutes(startDateTime, 60);
                }
            } else {
                // Fallback: default to 1 hour
                endDateTime = addMinutes(startDateTime, 60);
            }

            if (!isValid(endDateTime)) {
                throw new Error('Invalid end time calculation');
            }

            // Check for overlapping appointments (excluding the appointment being edited)
            // Allow adjacent appointments (e.g., 17:00-17:30 and 17:30-18:00 don't overlap)
            const overlappingAppointment = appointments.find(apt => {
                // Skip the appointment being edited
                if (editingAppointment && apt.id === editingAppointment.id) return false;

                // Only check appointments for the same team member
                if (apt.team_member_id !== formData.team_member_id) return false;

                // Check if appointment is on the same date
                const aptStart = parseISO(apt.start_time);
                const aptEnd = parseISO(apt.end_time);

                if (!isSameDay(aptStart, selectedDate)) return false;

                // Check for time overlap (exclusive boundaries to allow adjacent appointments)
                // Normalize times to seconds precision to avoid millisecond comparison issues
                const startSeconds = Math.floor(startDateTime.getTime() / 1000);
                const endSeconds = Math.floor(endDateTime.getTime() / 1000);
                const aptStartSeconds = Math.floor(aptStart.getTime() / 1000);
                const aptEndSeconds = Math.floor(aptEnd.getTime() / 1000);

                // If appointment start time equals existing appointment end time (in minutes), allow it (no overlap)
                // This works for both regular bookings and blocked time
                const startMinutes = getHours(startDateTime) * 60 + getMinutes(startDateTime);
                const aptEndMinutes = getHours(aptEnd) * 60 + getMinutes(aptEnd);

                // If appointment start time equals existing appointment end time, no overlap (allow it)
                if (startMinutes === aptEndMinutes) {
                    return false; // No overlap, allow appointment
                }

                // For all cases: Exclusive boundaries: start < aptEnd AND end > aptStart
                // This means 10:00-10:30 and 10:30-11:00 don't overlap
                // Also means 17:00-17:30 and 17:30-18:00 don't overlap (17:30 is not < 17:30 and 17:30 is not > 17:00)
                const overlaps = startSeconds < aptEndSeconds && endSeconds > aptStartSeconds;

                return overlaps;
            });

            if (overlappingAppointment) {
                toast({
                    variant: 'destructive',
                    title: 'Time Slot Occupied',
                    description: `This time slot overlaps with an existing appointment from ${format(parseISO(overlappingAppointment.start_time), 'HH:mm')} to ${format(parseISO(overlappingAppointment.end_time), 'HH:mm')}. Please choose a different time.`
                });
                setIsSaving(false);
                return;
            }

            let finalClientId = formData.client_id;
            let finalClientName = '';

            if (formData.client_id) {
                const client = clients.find(c => c.id === formData.client_id);
                finalClientName = client?.name || '';
            }

            const appointmentData = {
                id: editingAppointment?.id,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                team_member_id: formData.team_member_id,
                shop_id: currentShop.id,
                type: appointmentType,
                reason: appointmentType === 'blocked' ? formData.reason : formData.notes,
                client_id: appointmentType === 'appointment' ? finalClientId : null,
                service_id: appointmentType === 'appointment' ? formData.service_id : null,
                client_name: appointmentType === 'appointment' ? finalClientName : 'Blocked',
                price: appointmentType === 'appointment'
                    ? services.find(s => s.id === formData.service_id)?.price || 0
                    : null
            };

            const { error } = await supabase
                .from('appointments')
                .upsert(appointmentData);

            if (error) throw error;

            toast({
                title: 'Success!',
                description: `${appointmentType === 'blocked' ? 'Time block' : 'Appointment'} has been ${editingAppointment ? 'updated' : 'created'}.`
            });

            fetchData();
            setIsDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Save Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDragStart = (e, appointment) => {
        // Check if the appointment is in the past - prevent dragging past appointments
        const appointmentStart = parseISO(appointment.start_time);
        const now = new Date();
        if (isBefore(appointmentStart, now)) {
            e.preventDefault();
            toast({
                variant: 'destructive',
                title: 'Cannot Drag Past Appointment',
                description: 'You cannot drag appointments that are in the past.'
            });
            return;
        }

        // Store original position FIRST, before any state updates
        // This is the true original position before any auto-updates during drag
        originalAppointmentPosition.current = {
            start_time: appointment.start_time,
            end_time: appointment.end_time,
            team_member_id: appointment.team_member_id
        };

        console.log('🔵 DRAG START - Stored original position:', {
            id: appointment.id,
            start_time: appointment.start_time,
            end_time: appointment.end_time,
            team_member_id: appointment.team_member_id,
            stored: originalAppointmentPosition.current
        });

        setDraggedAppointment(appointment);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', appointment.id);

        // Calculate where on the appointment the user clicked (offset from top)
        const appointmentElement = e.currentTarget;
        const appointmentRect = appointmentElement.getBoundingClientRect();
        const clickY = e.clientY - appointmentRect.top; // Y position relative to appointment top
        setDragClickOffset(clickY);

        // Make the dragged element semi-transparent
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';

        // Wait a moment for any pending auto-updates to complete
        setTimeout(() => {
            setDraggedAppointment(null);
            setDragOverSlot(null);
            setDragPosition(null);
            setDragClickOffset(0);
            lastAutoUpdatePosition.current = null;
            isAutoUpdating.current = false;
            originalAppointmentPosition.current = null;
        }, 100);
    };

    const handleDragOver = (e, member, time) => {
        e.preventDefault();

        if (!draggedAppointment) return;

        // Calculate precise time based on mouse Y position within the slot
        const slotElement = e.currentTarget;
        const rect = slotElement.getBoundingClientRect();
        const mouseY = e.clientY - rect.top; // Y position relative to slot top

        // Calculate how many minutes from slot start based on mouse position
        const pixelsPerMinute = SLOT_HEIGHT / SLOT_DURATION_MINUTES;

        // Adjust mouse position to account for where user clicked on the appointment
        // If user clicked in the middle, we subtract that offset so the TOP of appointment aligns with mouse
        // This ensures the TOP of the appointment (start time) aligns with the drop position, not where user clicked
        const adjustedMouseY = mouseY - dragClickOffset;

        // Calculate the raw offset in minutes from slot start
        // When dragging upward, adjustedMouseY can be negative if user clicked near bottom of appointment
        // This is expected - we need to handle it properly to allow upward movement
        let rawOffsetMinutes = adjustedMouseY / pixelsPerMinute;

        // Handle cross-slot dragging when dragging upward (negative offset)
        let actualSlotTime = time;
        let finalOffsetMinutes = 0;
        let snappedY = 0;

        if (rawOffsetMinutes < 0) {
            // Dragging upward - need to check previous slot
            const currentSlotTime = parse(time, 'HH:mm', selectedDate);
            const previousSlotTime = addMinutes(currentSlotTime, -SLOT_DURATION_MINUTES);

            // Calculate offset in previous slot
            // If rawOffsetMinutes is -5, that means we want to go 5 minutes earlier than slot start
            // So if current slot is 10:00 and we drag up 5 minutes, we want 09:55
            // 09:55 is 25 minutes into the 09:30 slot (09:30 + 25 = 09:55)
            // So: offsetInPreviousSlot = SLOT_DURATION_MINUTES + rawOffsetMinutes = 30 + (-5) = 25
            const offsetInPreviousSlot = SLOT_DURATION_MINUTES + rawOffsetMinutes;

            // Round to nearest 5-minute interval FIRST (before clamping)
            // This ensures we capture all intervals: 25, 20, 15, 10, 5, 0
            let roundedOffset = Math.round((offsetInPreviousSlot + 0.001) / 5) * 5;

            // Clamp to valid range (0 to SLOT_DURATION_MINUTES)
            roundedOffset = Math.max(0, Math.min(SLOT_DURATION_MINUTES, roundedOffset));

            // Ensure it's a multiple of 5
            roundedOffset = Math.round(roundedOffset / 5) * 5;
            roundedOffset = Math.max(0, Math.min(SLOT_DURATION_MINUTES, roundedOffset));

            // Always use previous slot when dragging upward (unless offset rounds to 30, which means we're at the boundary)
            if (roundedOffset < SLOT_DURATION_MINUTES) {
                // Use previous slot
                actualSlotTime = format(previousSlotTime, 'HH:mm');
                finalOffsetMinutes = roundedOffset;
                snappedY = finalOffsetMinutes * pixelsPerMinute;
            } else {
                // If roundedOffset is exactly 30, we're at the boundary - stay in current slot at 0
                actualSlotTime = time;
                finalOffsetMinutes = 0;
                snappedY = 0;
            }
        } else {
            // Dragging downward or within slot - normal calculation
            // Allow wider range for downward dragging
            rawOffsetMinutes = Math.max(0, Math.min(SLOT_DURATION_MINUTES * 2, rawOffsetMinutes));

            // Round to nearest 5-minute interval
            let offsetMinutes = Math.round((rawOffsetMinutes + 0.001) / 5) * 5;

            // Clamp to valid slot boundaries
            offsetMinutes = Math.max(0, Math.min(SLOT_DURATION_MINUTES, offsetMinutes));

            // Ensure it's a multiple of 5
            finalOffsetMinutes = Math.round(offsetMinutes / 5) * 5;
            finalOffsetMinutes = Math.max(0, Math.min(SLOT_DURATION_MINUTES, finalOffsetMinutes));

            // Calculate snapped Y position
            snappedY = finalOffsetMinutes * pixelsPerMinute;
            actualSlotTime = time;
        }

        // Check if the drop position would overlap with existing appointments
        let overlappingAppointment = null;
        let newStartTime = null;
        let newEndTime = null;
        let isPastTime = false;

        if (draggedAppointment) {
            const slotStartTime = parse(actualSlotTime, 'HH:mm', selectedDate);
            newStartTime = addMinutes(slotStartTime, finalOffsetMinutes);

            // Check if the new start time is in the past
            const now = new Date();
            if (isBefore(newStartTime, now)) {
                isPastTime = true;
                e.dataTransfer.dropEffect = 'none';
                // Don't set drag position if it's in the past
                return;
            }

            const originalStart = parseISO(draggedAppointment.start_time);
            const originalEnd = parseISO(draggedAppointment.end_time);
            const duration = differenceInMinutes(originalEnd, originalStart);
            newEndTime = addMinutes(newStartTime, duration);

            // Check for overlapping appointments
            // IMPORTANT: We exclude the dragged appointment itself, so users can move it within its own time range
            // This includes moving within the buffer time area of the same appointment
            overlappingAppointment = appointments.find(apt => {
                // Skip the appointment being dragged - allows moving within same appointment's time range (including buffer)
                if (apt.id === draggedAppointment.id) return false;
                if (apt.team_member_id !== member.id) return false;

                const aptStart = parseISO(apt.start_time);
                const aptEnd = parseISO(apt.end_time);

                if (!isSameDay(aptStart, selectedDate)) return false;

                // Check for time overlap (exclusive boundaries to allow adjacent appointments)
                // Normalize times to seconds precision to avoid millisecond comparison issues
                const newStartSeconds = Math.floor(newStartTime.getTime() / 1000);
                const newEndSeconds = Math.floor(newEndTime.getTime() / 1000);
                const aptStartSeconds = Math.floor(aptStart.getTime() / 1000);
                const aptEndSeconds = Math.floor(aptEnd.getTime() / 1000);

                // If appointment start time equals existing appointment end time (in minutes), allow it (no overlap)
                // This works for both regular bookings and blocked time
                const newStartMinutes = getHours(newStartTime) * 60 + getMinutes(newStartTime);
                const aptEndMinutes = getHours(aptEnd) * 60 + getMinutes(aptEnd);

                // If appointment start time equals existing appointment end time, no overlap (allow it)
                if (newStartMinutes === aptEndMinutes) {
                    return false; // No overlap, allow appointment
                }

                // For all cases: Exclusive boundaries: newStart < aptEnd AND newEnd > aptStart
                // This means 10:00-10:30 and 10:30-11:00 don't overlap
                return newStartSeconds < aptEndSeconds && newEndSeconds > aptStartSeconds;
            });

            if (overlappingAppointment) {
                // Don't set dropEffect to 'none' - we want the drop event to fire so we can revert
                // Instead, we'll handle the revert in handleDrop
                e.dataTransfer.dropEffect = 'move'; // Allow drop event to fire
                console.log('🟡 DRAG OVER - Overlap detected, but allowing drop to fire for revert');
            } else if (isPastTime) {
                // Prevent dropping in past time slots
                e.dataTransfer.dropEffect = 'none';
                return;
            } else {
                e.dataTransfer.dropEffect = 'move';
            }
        } else {
            e.dataTransfer.dropEffect = 'move';
        }

        // Only set drag position if not in past
        if (!isPastTime) {
            setDragOverSlot({ member, time: actualSlotTime });
            setDragPosition({ member, time: actualSlotTime, offsetY: snappedY, offsetMinutes: finalOffsetMinutes });
        }

        // Auto-update appointment in background when passing each 5-minute interval
        // This makes the appointment update automatically as you drag, not just when you drop
        // Don't auto-update if the time is in the past
        if (draggedAppointment && !overlappingAppointment && !isPastTime && newStartTime && newEndTime) {
            // Create a unique key for this position (use actualSlotTime to handle cross-slot dragging)
            const positionKey = `${member.id}-${actualSlotTime}-${finalOffsetMinutes}`;

            // Only update if position has changed to a new interval
            if (lastAutoUpdatePosition.current !== positionKey && !isAutoUpdating.current) {
                // Check if this is actually a different position than current
                const currentStart = parseISO(draggedAppointment.start_time);
                const isDifferentPosition = !isSameDay(currentStart, selectedDate) ||
                    getHours(currentStart) !== getHours(newStartTime) ||
                    getMinutes(currentStart) !== getMinutes(newStartTime) ||
                    draggedAppointment.team_member_id !== member.id;

                if (isDifferentPosition) {
                    // Mark as updating to prevent concurrent updates
                    isAutoUpdating.current = true;
                    lastAutoUpdatePosition.current = positionKey;

                    console.log('🟡 AUTO-UPDATE - Updating appointment during drag:', {
                        id: draggedAppointment.id,
                        from: draggedAppointment.start_time,
                        to: newStartTime.toISOString(),
                        originalPosition: originalAppointmentPosition.current
                    });

                    // Update in background silently
                    (async () => {
                        try {
                            // Optimistically update UI first
                            const updatedAppointment = {
                                ...draggedAppointment,
                                start_time: newStartTime.toISOString(),
                                end_time: newEndTime.toISOString(),
                                team_member_id: member.id
                            };

                            setAppointments(prevAppointments =>
                                prevAppointments.map(apt =>
                                    apt.id === draggedAppointment.id ? updatedAppointment : apt
                                )
                            );

                            // Update in database silently
                            await supabase
                                .from('appointments')
                                .update({
                                    start_time: newStartTime.toISOString(),
                                    end_time: newEndTime.toISOString(),
                                    team_member_id: member.id
                                })
                                .eq('id', draggedAppointment.id);

                            // Update draggedAppointment state to reflect new position
                            setDraggedAppointment(updatedAppointment);

                            console.log('🟡 AUTO-UPDATE - Updated successfully, original position still:', originalAppointmentPosition.current);

                            // Silent refresh to ensure data is in sync
                            fetchData(true);
                        } catch (error) {
                            console.error('🟡 Error auto-updating appointment:', error);
                            // Revert on error
                            setAppointments(prevAppointments =>
                                prevAppointments.map(apt =>
                                    apt.id === draggedAppointment.id ? draggedAppointment : apt
                                )
                            );
                        } finally {
                            isAutoUpdating.current = false;
                        }
                    })();
                }
            }
        }
    };

    const handleDragLeave = (e) => {
        // Only clear if we're leaving the slot area, not entering a child element
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverSlot(null);
            setDragPosition(null);
        }
    };

    const handleDrop = async (e, targetMember, targetTime) => {
        e.preventDefault();
        setDragOverSlot(null);

        console.log('🟢 HANDLE DROP CALLED:', {
            targetMember: targetMember?.name,
            targetTime: targetTime,
            hasDraggedAppointment: !!draggedAppointment,
            draggedAppointmentId: draggedAppointment?.id
        });

        if (!draggedAppointment) {
            console.log('🟢 No dragged appointment, returning');
            return;
        }

        // Calculate precise drop time based on drag position (snapped to 5-minute intervals)
        let newStartTime;
        let offsetMinutes = 0;

        if (dragPosition && dragPosition.member.id === targetMember.id) {
            // Use precise position from drag (already rounded to 5-minute intervals)
            // dragPosition.time may be different from targetTime when dragging across slots (e.g., upward)
            const actualSlotTime = dragPosition.time;
            const slotStartTime = parse(actualSlotTime, 'HH:mm', selectedDate);
            offsetMinutes = dragPosition.offsetMinutes;
            // Ensure it's within valid range and is a multiple of 5
            offsetMinutes = Math.max(0, Math.min(SLOT_DURATION_MINUTES, Math.round(offsetMinutes / 5) * 5));
            newStartTime = addMinutes(slotStartTime, offsetMinutes);
        } else {
            // Fallback: calculate from mouse position if dragPosition is not available
            const slotStartTime = parse(targetTime, 'HH:mm', selectedDate);
            const slotElement = e.currentTarget;
            const rect = slotElement.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            const pixelsPerMinute = SLOT_HEIGHT / SLOT_DURATION_MINUTES;
            const adjustedMouseY = mouseY - dragClickOffset;
            let rawOffsetMinutes = adjustedMouseY / pixelsPerMinute;

            // Handle cross-slot dragging when dragging upward (same logic as handleDragOver)
            if (rawOffsetMinutes < 0) {
                // Dragging upward - need to check previous slot
                const previousSlotTime = addMinutes(slotStartTime, -SLOT_DURATION_MINUTES);
                const offsetInPreviousSlot = SLOT_DURATION_MINUTES + rawOffsetMinutes;
                let roundedOffset = Math.round((offsetInPreviousSlot + 0.001) / 5) * 5;
                roundedOffset = Math.max(0, Math.min(SLOT_DURATION_MINUTES, roundedOffset));
                roundedOffset = Math.round(roundedOffset / 5) * 5;
                roundedOffset = Math.max(0, Math.min(SLOT_DURATION_MINUTES, roundedOffset));

                if (roundedOffset < SLOT_DURATION_MINUTES) {
                    // Use previous slot
                    offsetMinutes = roundedOffset;
                    newStartTime = addMinutes(previousSlotTime, offsetMinutes);
                } else {
                    // At boundary - stay in current slot at 0
                    offsetMinutes = 0;
                    newStartTime = addMinutes(slotStartTime, 0);
                }
            } else {
                // Dragging downward or within slot - normal calculation
                rawOffsetMinutes = Math.max(0, Math.min(SLOT_DURATION_MINUTES * 2, rawOffsetMinutes));
                offsetMinutes = Math.round((rawOffsetMinutes + 0.001) / 5) * 5;
                offsetMinutes = Math.max(0, Math.min(SLOT_DURATION_MINUTES, offsetMinutes));
                offsetMinutes = Math.round(offsetMinutes / 5) * 5;
                offsetMinutes = Math.max(0, Math.min(SLOT_DURATION_MINUTES, offsetMinutes));
                newStartTime = addMinutes(slotStartTime, offsetMinutes);
            }
        }

        // Check if the calculated time is in the past
        const now = new Date();
        if (isBefore(newStartTime, now)) {
            toast({
                variant: 'destructive',
                title: 'Cannot Move Appointment',
                description: 'You cannot move appointments to the past.'
            });
            setDraggedAppointment(null);
            setDragPosition(null);
            return;
        }

        // Calculate new start and end times
        const originalStart = parseISO(draggedAppointment.start_time);
        const originalEnd = parseISO(draggedAppointment.end_time);
        const duration = differenceInMinutes(originalEnd, originalStart);

        const newEndTime = addMinutes(newStartTime, duration);

        // Check for overlapping appointments with the target member
        // IMPORTANT: We exclude the dragged appointment itself, so users can move it within its own time range
        console.log('🟢 Checking for overlaps:', {
            targetMember: targetMember.name,
            newStartTime: format(newStartTime, 'HH:mm'),
            newEndTime: format(newEndTime, 'HH:mm'),
            totalAppointments: appointments.length,
            draggedAppointmentId: draggedAppointment.id
        });

        const overlappingAppointment = appointments.find(apt => {
            // Skip the appointment being dragged - this allows moving within the same appointment's time range
            if (apt.id === draggedAppointment.id) {
                console.log('🟢 Skipping dragged appointment:', apt.id);
                return false;
            }

            // Only check appointments for the target member
            if (apt.team_member_id !== targetMember.id) {
                return false;
            }

            // Check if appointment is on the same date
            const aptStart = parseISO(apt.start_time);
            const aptEnd = parseISO(apt.end_time);

            if (!isSameDay(aptStart, selectedDate)) {
                return false;
            }

            // Check for time overlap
            // Normalize times to seconds precision to avoid millisecond comparison issues
            const newStartSeconds = Math.floor(newStartTime.getTime() / 1000);
            const newEndSeconds = Math.floor(newEndTime.getTime() / 1000);
            const aptStartSeconds = Math.floor(aptStart.getTime() / 1000);
            const aptEndSeconds = Math.floor(aptEnd.getTime() / 1000);

            // If appointment start time equals existing appointment end time (in minutes), allow it (no overlap)
            // This works for both regular bookings and blocked time
            const newStartMinutes = getHours(newStartTime) * 60 + getMinutes(newStartTime);
            const aptEndMinutes = getHours(aptEnd) * 60 + getMinutes(aptEnd);

            // If appointment start time equals existing appointment end time, no overlap (allow it)
            if (newStartMinutes === aptEndMinutes) {
                return false; // No overlap, allow appointment
            }

            // For all cases: Exclusive boundaries: newStart < aptEnd AND newEnd > aptStart
            // This means 10:00-10:30 and 10:30-11:00 don't overlap
            const overlaps = newStartSeconds < aptEndSeconds && newEndSeconds > aptStartSeconds;

            if (overlaps) {
                console.log('🟢 OVERLAP DETECTED:', {
                    overlappingAppointmentId: apt.id,
                    overlappingType: apt.type,
                    overlappingStart: format(aptStart, 'HH:mm'),
                    overlappingEnd: format(aptEnd, 'HH:mm'),
                    newStart: format(newStartTime, 'HH:mm'),
                    newEnd: format(newEndTime, 'HH:mm')
                });
            }

            return overlaps;
        });

        console.log('🟢 Overlap check complete:', {
            hasOverlap: !!overlappingAppointment,
            overlappingAppointmentId: overlappingAppointment?.id
        });

        if (overlappingAppointment) {
            console.log('🔴 DROP ON OCCUPIED SLOT - Reverting to original position');
            console.log('🔴 Drop details:', {
                targetMember: targetMember.name,
                targetTime: targetTime,
                dropStartTime: format(newStartTime, 'HH:mm'),
                dropEndTime: format(newEndTime, 'HH:mm')
            });
            console.log('🔴 Overlapping appointment:', {
                id: overlappingAppointment.id,
                start_time: format(parseISO(overlappingAppointment.start_time), 'HH:mm'),
                end_time: format(parseISO(overlappingAppointment.end_time), 'HH:mm'),
                team_member_id: overlappingAppointment.team_member_id
            });
            console.log('🔴 Current draggedAppointment:', {
                id: draggedAppointment.id,
                start_time: draggedAppointment.start_time,
                end_time: draggedAppointment.end_time,
                team_member_id: draggedAppointment.team_member_id
            });
            console.log('🔴 Stored original position:', originalAppointmentPosition.current);

            // Revert appointment to its original position (stored at drag start, before any auto-updates)
            if (originalAppointmentPosition.current) {
                const originalPosition = originalAppointmentPosition.current;

                // Get the appointment ID from draggedAppointment (which may have been updated during drag)
                const appointmentId = draggedAppointment.id;

                console.log('🔴 Reverting appointment ID:', appointmentId, 'to:', originalPosition);

                // First, update in database to ensure consistency - use the original position
                // Do this BEFORE updating UI state to prevent race conditions
                try {
                    const { error } = await supabase
                        .from('appointments')
                        .update({
                            start_time: originalPosition.start_time,
                            end_time: originalPosition.end_time,
                            team_member_id: originalPosition.team_member_id
                        })
                        .eq('id', appointmentId);

                    if (error) {
                        console.error('🔴 Error reverting in database:', error);
                        throw error;
                    }

                    console.log('🔴 Successfully reverted in database');

                    // Now update the UI state to match the database
                    setAppointments(prevAppointments => {
                        const updated = prevAppointments.map(apt =>
                            apt.id === appointmentId
                                ? {
                                    ...apt,
                                    start_time: originalPosition.start_time,
                                    end_time: originalPosition.end_time,
                                    team_member_id: originalPosition.team_member_id
                                }
                                : apt
                        );
                        console.log('🔴 Updated appointments state, new position for appointment:',
                            updated.find(apt => apt.id === appointmentId));
                        return updated;
                    });

                    // Don't call fetchData here - it would overwrite our state update
                    // The database is already updated and the state is updated above
                    // The appointment should now be visible in its original position
                } catch (error) {
                    console.error('🔴 Error reverting appointment:', error);

                    // Even if database update fails, try to revert UI state
                    setAppointments(prevAppointments =>
                        prevAppointments.map(apt =>
                            apt.id === appointmentId
                                ? {
                                    ...apt,
                                    start_time: originalPosition.start_time,
                                    end_time: originalPosition.end_time,
                                    team_member_id: originalPosition.team_member_id
                                }
                                : apt
                        )
                    );

                    toast({
                        variant: 'destructive',
                        title: 'Revert Failed',
                        description: 'Failed to revert appointment. Please refresh the page.'
                    });
                }
            } else {
                console.error('🔴 No original position stored! Cannot revert.');
            }

            toast({
                variant: 'destructive',
                title: 'Slot Occupied',
                description: `This time slot is already occupied. The appointment has been returned to its original position.`
            });

            setDraggedAppointment(null);
            setDragPosition(null);
            setDragClickOffset(0);
            originalAppointmentPosition.current = null;
            lastAutoUpdatePosition.current = null;
            isAutoUpdating.current = false;
            return;
        }

        // If we reach here, the drop is valid - clear the temp original position
        // The appointment will be updated to the new position
        console.log('✅ Valid drop - Clearing original position temp variable');
        originalAppointmentPosition.current = null;

        // Store original appointment for potential rollback
        const originalAppointment = { ...draggedAppointment };

        // Optimistically update the appointment in the UI immediately
        // This keeps the appointment in its new position while we update in the background
        const updatedAppointment = {
            ...draggedAppointment,
            start_time: newStartTime.toISOString(),
            end_time: newEndTime.toISOString(),
            team_member_id: targetMember.id
        };

        // Update appointments state immediately (optimistic update)
        setAppointments(prevAppointments =>
            prevAppointments.map(apt =>
                apt.id === draggedAppointment.id ? updatedAppointment : apt
            )
        );

        // Clear drag state immediately so the appointment stays in its new position
        setDraggedAppointment(null);
        setDragPosition(null);
        setDragClickOffset(0);
        lastAutoUpdatePosition.current = null;
        isAutoUpdating.current = false;
        // Clear the temp original position since drop was successful
        originalAppointmentPosition.current = null;

        // Update in the background silently (no loading state, no toast)
        try {
            const { error } = await supabase
                .from('appointments')
                .update({
                    start_time: newStartTime.toISOString(),
                    end_time: newEndTime.toISOString(),
                    team_member_id: targetMember.id
                })
                .eq('id', originalAppointment.id);

            if (error) throw error;

            // Silent refresh to ensure data is in sync (runs in background)
            fetchData(true);
        } catch (error) {
            console.error('Error moving appointment:', error);

            // Revert optimistic update on error - use original position if available, otherwise use originalAppointment
            const revertPosition = originalAppointmentPosition.current || {
                start_time: originalAppointment.start_time,
                end_time: originalAppointment.end_time,
                team_member_id: originalAppointment.team_member_id
            };

            setAppointments(prevAppointments =>
                prevAppointments.map(apt =>
                    apt.id === originalAppointment.id
                        ? {
                            ...apt,
                            start_time: revertPosition.start_time,
                            end_time: revertPosition.end_time,
                            team_member_id: revertPosition.team_member_id
                        }
                        : apt
                )
            );

            toast({
                variant: "destructive",
                title: "Move Failed",
                description: error.message || "Failed to move appointment. The appointment has been restored to its original position."
            });
        }
    };

    const handleDeleteAppointment = async () => {
        if (!editingAppointment) return;

        const isBlocked = editingAppointment.type === 'blocked';

        showDialog({
            title: isBlocked ? 'Unblock Time?' : 'Delete Appointment?',
            description: `Are you sure you want to ${isBlocked ? 'unblock this time slot' : 'delete this appointment'}? This action cannot be undone.`,
            confirmText: isBlocked ? 'Unblock' : 'Delete',
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('appointments')
                        .delete()
                        .eq('id', editingAppointment.id);

                    if (error) throw error;

                    toast({
                        title: 'Success!',
                        description: `The ${isBlocked ? 'time block' : 'appointment'} has been ${isBlocked ? 'unblocked' : 'deleted'}.`
                    });

                    fetchData();
                    setIsDialogOpen(false);
                } catch (error) {
                    toast({ variant: "destructive", title: "Delete Failed", description: error.message });
                }
            },
        });
    };

    const getAppointmentForSlot = (memberId, time) => {
        const slotStartTime = parse(time, 'HH:mm', selectedDate);
        const slotEndTime = addMinutes(slotStartTime, SLOT_DURATION_MINUTES);

        // First, prioritize appointments that START in this slot
        // This ensures adjacent appointments (e.g., 17:00-17:30 and 17:30-18:00) both show correctly
        for (const apt of appointments) {
            if (apt.team_member_id === memberId) {
                const aptStart = parseISO(apt.start_time);
                const aptEnd = parseISO(apt.end_time);

                // Normalize dates to selectedDate for comparison
                const aptStartNormalized = setHours(setMinutes(selectedDate, getMinutes(aptStart)), getHours(aptStart));
                const aptEndNormalized = setHours(setMinutes(selectedDate, getMinutes(aptEnd)), getHours(aptEnd));

                // Check if appointment STARTS in this slot
                // This is the priority - appointments that start in a slot should be shown in that slot
                if (aptStartNormalized >= slotStartTime && aptStartNormalized < slotEndTime) {
                    return apt;
                }
            }
        }

        // If no appointment starts in this slot, check for appointments that overlap but start in previous slots
        // This handles appointments that span multiple slots (e.g., 16:45-17:15 spans both 16:30 and 17:00 slots)
        for (const apt of appointments) {
            if (apt.team_member_id === memberId) {
                const aptStart = parseISO(apt.start_time);
                const aptEnd = parseISO(apt.end_time);

                // Normalize dates to selectedDate for comparison
                const aptStartNormalized = setHours(setMinutes(selectedDate, getMinutes(aptStart)), getHours(aptStart));
                const aptEndNormalized = setHours(setMinutes(selectedDate, getMinutes(aptEnd)), getHours(aptEnd));

                // Check for overlap (appointment starts before this slot but extends into it)
                if (aptStartNormalized < slotStartTime && aptEndNormalized > slotStartTime) {
                    return apt;
                }
            }
        }

        return null;
    };

    const getAppointmentStyle = (appointment, slotStartTime = null) => {
        const start = parseISO(appointment.start_time);
        const end = parseISO(appointment.end_time);
        const duration = differenceInMinutes(end, start);

        // Get buffer time from service if available
        const bufferTime = appointment.services?.buffer_time || 0;
        const serviceDuration = appointment.services?.duration || (duration - bufferTime);

        // Get hours and minutes from the appointment time
        const startHour = getHours(start);
        const startMinute = getMinutes(start);
        const startTotalMinutes = startHour * 60 + startMinute;

        // Calculate pixels per minute for accurate sizing
        const pixelsPerMinute = SLOT_HEIGHT / SLOT_DURATION_MINUTES;

        let top = 0;

        if (slotStartTime) {
            // Calculate position relative to the slot's start time
            const slotHour = getHours(slotStartTime);
            const slotMinute = getMinutes(slotStartTime);
            const slotTotalMinutes = slotHour * 60 + slotMinute;

            // Position within the slot (offset from slot start)
            const offsetMinutes = startTotalMinutes - slotTotalMinutes;
            top = offsetMinutes * pixelsPerMinute;
        } else {
            // Calculate top position relative to START_HOUR (for absolute positioning)
            const totalMinutes = (startHour - START_HOUR) * 60 + startMinute;
            top = totalMinutes * pixelsPerMinute;
        }

        // Calculate height based on total duration (service + buffer)
        const totalHeight = duration * pixelsPerMinute;

        // Calculate service duration height (without buffer)
        const serviceHeight = serviceDuration * pixelsPerMinute;

        // Calculate buffer time height
        const bufferHeight = bufferTime * pixelsPerMinute;

        return {
            height: `${Math.max(totalHeight - 2, 20)}px`, // Total height minus border
            top: `${Math.max(top, 0)}px`, // Ensure top is not negative
            bufferHeight: `${Math.max(bufferHeight, 0)}px`, // Buffer time height
            serviceHeight: `${Math.max(serviceHeight - 2, 20)}px` // Service duration height
        };
    };

    // Generate colors for team members
    const getMemberColor = useCallback((memberId) => {
        const colors = [
            { bg: '#008000', hover: '#006600', border: 'rgba(0, 128, 0, 0.5)' }, // Green (default)
            { bg: '#2563eb', hover: '#1d4ed8', border: 'rgba(37, 99, 235, 0.5)' }, // Blue
            { bg: '#9333ea', hover: '#7e22ce', border: 'rgba(147, 51, 234, 0.5)' }, // Violet (replaced Red)
            { bg: '#ea580c', hover: '#c2410c', border: 'rgba(234, 88, 12, 0.5)' }, // Orange
            { bg: '#7c3aed', hover: '#6d28d9', border: 'rgba(124, 58, 237, 0.5)' }, // Purple
            { bg: '#059669', hover: '#047857', border: 'rgba(5, 150, 105, 0.5)' }, // Emerald
            { bg: '#0891b2', hover: '#0e7490', border: 'rgba(8, 145, 178, 0.5)' }, // Cyan
            { bg: '#be185d', hover: '#9f1239', border: 'rgba(190, 24, 93, 0.5)' }, // Pink
            { bg: '#ca8a04', hover: '#a16207', border: 'rgba(202, 138, 4, 0.5)' }, // Yellow/Amber
            { bg: '#64748b', hover: '#475569', border: 'rgba(100, 116, 139, 0.5)' }, // Slate
        ];

        // Use member index from filtered team members to assign color consistently
        const memberIndex = filteredTeamMembers.findIndex(m => m.id === memberId);
        // If member not found in filtered list, fall back to all team members
        if (memberIndex === -1) {
            const fallbackIndex = teamMembers.findIndex(m => m.id === memberId);
            return colors[fallbackIndex % colors.length] || colors[0];
        }
        return colors[memberIndex % colors.length] || colors[0];
    }, [filteredTeamMembers, teamMembers]);

    const timeIndicatorTop = useMemo(() => {
        if (!isToday(selectedDate)) return null;

        const totalMinutes = (getHours(currentTime) - START_HOUR) * 60 + getMinutes(currentTime);
        const pixelsPerMinute = SLOT_HEIGHT / SLOT_DURATION_MINUTES;
        return totalMinutes * pixelsPerMinute;
    }, [currentTime, selectedDate, START_HOUR]);

    const filteredEndTimeSlots = useMemo(() =>
        fullTimeSlots.filter(t => t > formData.start_time),
        [fullTimeSlots, formData.start_time]
    );

    const filteredBlockedEndTimeSlots = useMemo(() =>
        fullTimeSlots.filter(t => t > formData.start_time),
        [fullTimeSlots, formData.start_time]
    );

    const currentMember = teamMembers.find(t => t.id === formData.team_member_id);
    const currentMemberServices = currentMember?.services || [];

    const isSaveDisabled = isSaving ||
        (appointmentType === 'appointment' &&
            (!formData.service_id || !formData.start_time ||
                (!formData.client_id || (formData.client_id === 'new-client' && !formData.client_name)) ||
                !formData.team_member_id)) ||
        (appointmentType === 'blocked' &&
            (!formData.start_time || !formData.end_time ||
                formData.start_time >= formData.end_time || !formData.team_member_id));

    return (
        <Layout>
            <Helmet><title>Calendar | {currentShop?.name || 'Loading...'}</title></Helmet>
            <div className="flex h-screen pb-24 bg-white relative">
                {/* Mobile Sidebar Overlay */}
                {sidebarOpen && (
                    <div
                        className="lg:hidden fixed inset-0 bg-black/50 z-40"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Left Sidebar Calendar */}
                <div className={`
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                    lg:translate-x-0
                    fixed lg:static
                    top-0 left-0 h-full
                    w-80 border-r border-gray-200 bg-white p-4 overflow-y-auto z-50
                    transition-transform duration-300 ease-in-out
                    shadow-lg lg:shadow-none
                `}>
                    <div className="sticky top-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Select Date</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(false)}
                                className="lg:hidden text-gray-600 hover:text-gray-900"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                            <DayPicker
                                mode="single"
                                selected={selectedDate}
                                onSelect={(d) => {
                                    if (d) {
                                        setSelectedDate(d);
                                        setSidebarOpen(false); // Close sidebar on mobile after selection
                                    }
                                }}
                                className="rounded-md"
                                classNames={{
                                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                                    month: "space-y-4",
                                    caption: "flex justify-center pt-1 relative items-center",
                                    caption_label: "text-sm font-medium text-gray-900",
                                    nav: "space-x-1 flex items-center",
                                    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-gray-600 hover:text-gray-900",
                                    nav_button_previous: "absolute left-1",
                                    nav_button_next: "absolute right-1",
                                    table: "w-full border-collapse space-y-1",
                                    head_row: "flex",
                                    head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
                                    row: "flex w-full mt-2",
                                    cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-[#008000]/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                    day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md",
                                    day_selected: "bg-[#008000] text-white hover:bg-[#006600] hover:text-white focus:bg-[#006600] focus:text-white",
                                    day_today: "bg-gray-100 text-gray-900 font-semibold",
                                    day_outside: "text-gray-400 opacity-50",
                                    day_disabled: "text-gray-400 opacity-50",
                                    day_range_middle: "aria-selected:bg-[#008000]/20 aria-selected:text-gray-900",
                                    day_hidden: "invisible",
                                }}
                                modifiersClassNames={{
                                    selected: "bg-[#008000] text-white hover:bg-[#006600]",
                                    today: "bg-gray-100 font-semibold"
                                }}
                            />
                        </div>
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-sm text-gray-600 mb-2">Quick Actions</div>
                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedDate(new Date())}
                                    className="justify-start text-gray-700 hover:bg-[#008000] hover:text-white"
                                >
                                    <CalendarIcon className="w-4 h-4 mr-2" />
                                    Today
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedDate(addDays(new Date(), 1))}
                                    className="justify-start text-gray-700 hover:bg-[#008000] hover:text-white"
                                >
                                    <CalendarIcon className="w-4 h-4 mr-2" />
                                    Tomorrow
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                                    className="justify-start text-gray-700 hover:bg-[#008000] hover:text-white"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Previous Day
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                                    className="justify-start text-gray-700 hover:bg-[#008000] hover:text-white"
                                >
                                    <ChevronRight className="w-4 h-4 mr-2" />
                                    Next Day
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row items-center justify-between p-4 border-b border-gray-200 bg-white z-20 gap-4">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            {/* Mobile Menu Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="lg:hidden text-gray-600 hover:text-gray-900"
                            >
                                <MenuIcon className="w-5 h-5" />
                            </Button>
                            <h1 className="text-2xl font-bold text-gray-900 hidden md:block">Calendar</h1>

                            {/* Shop Selector */}
                            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
                                <MapPin className="w-4 h-4 text-gray-600 ml-2" />
                                {shopLoading ? (
                                    <div className="w-[180px] h-8 flex items-center justify-center">
                                        <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                                    </div>
                                ) : shops.length === 0 ? (
                                    <div className="w-[180px] h-8 flex items-center justify-center text-sm text-gray-500">
                                        No shops
                                    </div>
                                ) : (
                                    <Select
                                        value={currentShop?.id || ''}
                                        onValueChange={(val) => {
                                            const selectedShop = shops.find(s => s.id === val);
                                            console.log('Calendar: Shop selected:', selectedShop);
                                            if (selectedShop) {
                                                setCurrentShop(selectedShop);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-[180px] border-none bg-transparent focus:ring-0 text-gray-900 font-medium h-8">
                                            <SelectValue placeholder="Select Shop">
                                                {currentShop ? currentShop.name : (shops.length > 0 ? shops[0].name : 'Select Shop')}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="bg-white border-gray-200 text-gray-900 max-h-[300px] overflow-y-auto">
                                            {shops.map(shop => {
                                                console.log('Calendar: Rendering shop option:', shop.id, shop.name);
                                                return (
                                                    <SelectItem key={shop.id} value={shop.id}>
                                                        {shop.name}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between">
                            {/* Refresh Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => fetchData()}
                                className="text-gray-600 hover:text-gray-900 h-8 w-8"
                                title="Refresh calendar"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>

                            <div className="flex items-center gap-1 bg-white rounded-xl p-1.5 border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedDate(d => addDays(d, -1))}
                                    className="text-gray-500 hover:text-[#008000] hover:bg-[#008000]/10 h-9 w-9 rounded-lg transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="text-gray-900 font-semibold h-9 px-4 hover:bg-[#008000]/10 hover:text-[#008000] rounded-lg transition-colors min-w-[200px] justify-start"
                                        >
                                            <CalendarIcon className="w-4 h-4 mr-2.5 text-[#008000]" />
                                            <span className="text-sm">{format(selectedDate, 'MMMM d, yyyy')}</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-white border-2 border-gray-200 text-gray-900 shadow-xl rounded-xl overflow-hidden">
                                        <DayPicker
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={(d) => d && setSelectedDate(d)}
                                            initialFocus
                                            className="p-3"
                                            classNames={{
                                                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                                                month: "space-y-4",
                                                caption: "flex justify-center pt-1 relative items-center",
                                                caption_label: "text-sm font-semibold text-gray-900",
                                                nav: "space-x-1 flex items-center",
                                                nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-gray-600 hover:text-[#008000] rounded-md transition-colors",
                                                nav_button_previous: "absolute left-1",
                                                nav_button_next: "absolute right-1",
                                                table: "w-full border-collapse space-y-1",
                                                head_row: "flex",
                                                head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
                                                row: "flex w-full mt-2",
                                                cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-[#008000]/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-[#008000]/10 hover:text-[#008000] rounded-md transition-colors",
                                                day_selected: "bg-[#008000] text-white hover:bg-[#006600] hover:text-white focus:bg-[#006600] focus:text-white",
                                                day_today: "bg-gray-100 text-gray-900 font-semibold",
                                                day_outside: "text-gray-400 opacity-50",
                                                day_disabled: "text-gray-400 opacity-50",
                                                day_range_middle: "aria-selected:bg-[#008000]/20 aria-selected:text-gray-900",
                                                day_hidden: "invisible",
                                            }}
                                            modifiersClassNames={{
                                                selected: "bg-[#008000] text-white hover:bg-[#006600]",
                                                today: "bg-gray-100 font-semibold"
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedDate(d => addDays(d, 1))}
                                    className="text-gray-500 hover:text-[#008000] hover:bg-[#008000]/10 h-9 w-9 rounded-lg transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="flex-1 overflow-x-auto overflow-y-auto bg-white relative" ref={calendarGridRef}>
                        {shopLoading ? (
                            <div className="flex h-full items-center justify-center text-gray-500">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                                    <p>Loading shops...</p>
                                </div>
                            </div>
                        ) : !currentShop ? (
                            <div className="flex h-full items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <Ban className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-semibold mb-2">No Shop Selected</p>
                                    <p className="text-sm">Please create a shop first in Settings → Shop Management</p>
                                    {shops.length === 0 && (
                                        <p className="text-xs text-gray-400 mt-2">No shops found in database</p>
                                    )}
                                </div>
                            </div>
                        ) : loading ? (
                            <div className="flex h-full items-center justify-center text-gray-500">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                                    <p>Loading schedule...</p>
                                </div>
                            </div>
                        ) : filteredTeamMembers.length > 0 ? (
                            <div className="min-w-[800px]">
                                {/* Header Row */}
                                <div
                                    className="sticky top-0 z-10 grid bg-white border-b-2 border-gray-200 shadow-sm"
                                    style={{ gridTemplateColumns: `100px repeat(${filteredTeamMembers.length}, 1fr)` }}
                                >
                                    <div className="p-4 border-r border-gray-200 bg-white/80 backdrop-blur-sm sticky left-0 z-20"></div>
                                    {filteredTeamMembers.map(member => (
                                        <div
                                            key={member.id}
                                            className="p-4 border-r border-gray-200 text-center bg-white/80 backdrop-blur-sm hover:bg-gray-50/50 transition-colors cursor-pointer"
                                            onMouseEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const tooltipWidth = 300;
                                                const tooltipHeight = 400;
                                                const windowWidth = window.innerWidth;
                                                const windowHeight = window.innerHeight;

                                                // Calculate position - try to show to the right first
                                                let x = rect.right + 10;
                                                let y = rect.top;

                                                // If tooltip would overflow right, show to the left
                                                if (x + tooltipWidth > windowWidth) {
                                                    x = rect.left - tooltipWidth - 10;
                                                }

                                                // If tooltip would overflow bottom, adjust y
                                                if (y + tooltipHeight > windowHeight) {
                                                    y = windowHeight - tooltipHeight - 10;
                                                }

                                                // Ensure tooltip doesn't go above viewport
                                                if (y < 10) {
                                                    y = 10;
                                                }

                                                // Ensure tooltip doesn't go left of viewport
                                                if (x < 10) {
                                                    x = 10;
                                                }

                                                setHoveredTeamMember(member);
                                                setTeamMemberTooltipPosition({ x, y });
                                            }}
                                            onMouseLeave={() => {
                                                setHoveredTeamMember(null);
                                            }}
                                            onMouseMove={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const tooltipWidth = 300;
                                                const tooltipHeight = 400;
                                                const windowWidth = window.innerWidth;
                                                const windowHeight = window.innerHeight;

                                                // Calculate position - try to show to the right first
                                                let x = rect.right + 10;
                                                let y = rect.top;

                                                // If tooltip would overflow right, show to the left
                                                if (x + tooltipWidth > windowWidth) {
                                                    x = rect.left - tooltipWidth - 10;
                                                }

                                                // If tooltip would overflow bottom, adjust y
                                                if (y + tooltipHeight > windowHeight) {
                                                    y = windowHeight - tooltipHeight - 10;
                                                }

                                                // Ensure tooltip doesn't go above viewport
                                                if (y < 10) {
                                                    y = 10;
                                                }

                                                // Ensure tooltip doesn't go left of viewport
                                                if (x < 10) {
                                                    x = 10;
                                                }

                                                setTeamMemberTooltipPosition({ x, y });
                                            }}
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="relative group">
                                                    <div className="absolute inset-0 bg-[#008000] rounded-full blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                                    <img
                                                        src={member.image_url || `https://ui-avatars.com/api/?name=${member.name}&background=random`}
                                                        alt={member.name}
                                                        className="relative w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover ring-2 ring-gray-200"
                                                        onError={(e) => {
                                                            // Fallback to avatar API if image fails to load
                                                            const fallbackUrl = `https://ui-avatars.com/api/?name=${member.name.replace(' ', '+')}&background=008000&color=ffffff&size=128`;
                                                            if (e.target.src !== fallbackUrl) {
                                                                e.target.src = fallbackUrl;
                                                            } else {
                                                                // If avatar API also fails, show placeholder
                                                                e.target.src = `https://ui-avatars.com/api/?name=${member.name.replace(' ', '+')}&background=cccccc&color=ffffff&size=128`;
                                                            }
                                                        }}
                                                    />
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
                                                </div>
                                                <span className="font-semibold text-gray-900 text-sm leading-tight">{member.name}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Time Slots Grid */}
                                <div className="relative bg-white">
                                    {timeSlotsForGrid.map((time, timeIndex) => {
                                        const isHourMark = time.endsWith(':00');
                                        return (
                                            <div
                                                key={time}
                                                className={`grid group transition-all ${isHourMark ? 'bg-gray-50/50' : ''
                                                    } hover:bg-gray-50/70`}
                                                style={{ gridTemplateColumns: `100px repeat(${filteredTeamMembers.length}, 1fr)` }}
                                            >
                                                {/* Time Column */}
                                                <div className={`h-[60px] pt-0 pb-3 px-3 border-r border-b border-gray-200 text-xs text-gray-600 text-right sticky left-0 bg-white z-20 font-mono font-medium flex flex-col items-end justify-start relative ${isHourMark ? 'text-gray-900 font-semibold' : 'text-gray-500'
                                                    }`}>
                                                    {(() => {
                                                        // Check if this time slot is being dragged over
                                                        const isDragOverThisSlot = dragOverSlot?.time === time;
                                                        const hasDragPosition = isDragOverThisSlot && dragPosition && draggedAppointment;

                                                        let previewTime = null;
                                                        if (hasDragPosition) {
                                                            const slotStartTime = parse(time, 'HH:mm', selectedDate);
                                                            const offsetMinutes = dragPosition.offsetMinutes; // Already rounded to 5-minute intervals
                                                            const calculatedTime = addMinutes(slotStartTime, offsetMinutes);
                                                            previewTime = format(calculatedTime, 'HH:mm');
                                                        }

                                                        // Show only preview time when dragging, otherwise show slot time
                                                        if (previewTime) {
                                                            return (
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    className="bg-[#008000] text-white px-2.5 py-1.5 rounded-md shadow-lg flex items-center gap-1.5 w-fit -mt-0.5"
                                                                >
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    <span className="text-sm font-semibold">{previewTime}</span>
                                                                </motion.div>
                                                            );
                                                        }

                                                        // Normal slot time display
                                                        return isHourMark ? (
                                                            <span className="text-sm -mt-0.5">{time}</span>
                                                        ) : (
                                                            <span className="opacity-60 -mt-0.5">{time}</span>
                                                        );
                                                    })()}
                                                </div>

                                                {/* Member Columns for this Time Slot */}
                                                {filteredTeamMembers.map(member => {
                                                    let appointmentAtSlot = getAppointmentForSlot(member.id, time);
                                                    const slotStartTime = parse(time, 'HH:mm', selectedDate);
                                                    const isPastSlot = isSlotInPast(time);

                                                    // Check if drop position would overlap with existing appointments FIRST
                                                    // This needs to be calculated before we decide whether to show the dragged appointment
                                                    let wouldOverlap = false;
                                                    if (draggedAppointment && dragPosition && dragPosition.member?.id === member.id && dragPosition.time === time) {
                                                        // Use dragPosition.time (which may be different from current slot when dragging across slots)
                                                        const slotStartTimeForDrop = parse(dragPosition.time, 'HH:mm', selectedDate);
                                                        const offsetMinutes = dragPosition.offsetMinutes;
                                                        const newStartTime = addMinutes(slotStartTimeForDrop, offsetMinutes);
                                                        const originalStart = parseISO(draggedAppointment.start_time);
                                                        const originalEnd = parseISO(draggedAppointment.end_time);
                                                        const duration = differenceInMinutes(originalEnd, originalStart);
                                                        const newEndTime = addMinutes(newStartTime, duration);

                                                        // Check for overlaps, excluding the dragged appointment itself
                                                        const overlappingApt = appointments.find(apt => {
                                                            if (apt.id === draggedAppointment.id) return false;
                                                            if (apt.team_member_id !== member.id) return false;

                                                            const aptStart = parseISO(apt.start_time);
                                                            const aptEnd = parseISO(apt.end_time);

                                                            if (!isSameDay(aptStart, selectedDate)) return false;

                                                            // Check for time overlap (exclusive boundaries to allow adjacent appointments)
                                                            // Normalize times to seconds precision to avoid millisecond comparison issues
                                                            const newStartSeconds = Math.floor(newStartTime.getTime() / 1000);
                                                            const newEndSeconds = Math.floor(newEndTime.getTime() / 1000);
                                                            const aptStartSeconds = Math.floor(aptStart.getTime() / 1000);
                                                            const aptEndSeconds = Math.floor(aptEnd.getTime() / 1000);

                                                            // If appointment start time equals existing appointment end time (in minutes), allow it (no overlap)
                                                            // This works for both regular bookings and blocked time
                                                            const newStartMinutes = getHours(newStartTime) * 60 + getMinutes(newStartTime);
                                                            const aptEndMinutes = getHours(aptEnd) * 60 + getMinutes(aptEnd);

                                                            // If appointment start time equals existing appointment end time, no overlap (allow it)
                                                            if (newStartMinutes === aptEndMinutes) {
                                                                return false; // No overlap, allow appointment
                                                            }

                                                            // For all cases: Exclusive boundaries: newStart < aptEnd AND newEnd > aptStart
                                                            // This allows adjacent appointments (e.g., 10:30 exactly after 10:00-10:30)
                                                            const overlaps = newStartSeconds < aptEndSeconds && newEndSeconds > aptStartSeconds;

                                                            return overlaps;
                                                        });

                                                        if (overlappingApt) {
                                                            wouldOverlap = true;
                                                            // Debug log when overlap is detected with blocked time
                                                            if (overlappingApt.type === 'blocked') {
                                                                console.log('🔴 Overlap detected with blocked time:', {
                                                                    blockedTime: `${format(parseISO(overlappingApt.start_time), 'HH:mm')} - ${format(parseISO(overlappingApt.end_time), 'HH:mm')}`,
                                                                    newTime: `${format(newStartTime, 'HH:mm')} - ${format(newEndTime, 'HH:mm')}`,
                                                                    newStartSeconds: Math.floor(newStartTime.getTime() / 1000),
                                                                    aptEndSeconds: Math.floor(parseISO(overlappingApt.end_time).getTime() / 1000),
                                                                    newEndSeconds: Math.floor(newEndTime.getTime() / 1000),
                                                                    aptStartSeconds: Math.floor(parseISO(overlappingApt.start_time).getTime() / 1000)
                                                                });
                                                            }
                                                        }
                                                    }

                                                    // If dragging an appointment to this slot, show it here even if it doesn't normally start here
                                                    // This makes the appointment visually snap to each 5-minute interval as you drag
                                                    // BUT: Don't show it if the slot is occupied (wouldOverlap) or in the past - this prevents the "dancing" effect
                                                    if (draggedAppointment && dragPosition &&
                                                        dragPosition.member?.id === member.id &&
                                                        dragPosition.time === time &&
                                                        draggedAppointment.id !== appointmentAtSlot?.id &&
                                                        !wouldOverlap &&
                                                        !isPastSlot) { // Don't show dragged appointment in occupied slots or past slots
                                                        // Check if the new start time would be in the past
                                                        const slotStartTimeForDrop = parse(dragPosition.time, 'HH:mm', selectedDate);
                                                        const offsetMinutes = dragPosition.offsetMinutes;
                                                        const newStartTime = addMinutes(slotStartTimeForDrop, offsetMinutes);
                                                        const now = new Date();

                                                        // Only show if not in the past
                                                        if (!isBefore(newStartTime, now)) {
                                                            // Show the dragged appointment in this slot at the drag position
                                                            appointmentAtSlot = draggedAppointment;
                                                        }
                                                    }

                                                    // Check if this slot contains the start of an appointment
                                                    let isStartOfBooking = false;
                                                    if (appointmentAtSlot) {
                                                        const aptStart = parseISO(appointmentAtSlot.start_time);
                                                        const aptStartTimeStr = format(aptStart, 'HH:mm');
                                                        // Check if appointment starts in this slot or earlier slots
                                                        const slotTimeMinutes = getHours(slotStartTime) * 60 + getMinutes(slotStartTime);
                                                        const aptStartMinutes = getHours(aptStart) * 60 + getMinutes(aptStart);
                                                        const slotEndMinutes = slotTimeMinutes + SLOT_DURATION_MINUTES;

                                                        // Appointment starts in this slot if its start time is within this slot's range
                                                        // OR if it's being dragged to this slot
                                                        const isDraggedToThisSlot = draggedAppointment && dragPosition &&
                                                            dragPosition.member?.id === member.id &&
                                                            dragPosition.time === time &&
                                                            draggedAppointment.id === appointmentAtSlot.id;

                                                        isStartOfBooking = (aptStartMinutes >= slotTimeMinutes && aptStartMinutes < slotEndMinutes) || isDraggedToThisSlot;
                                                    }

                                                    const isDragOver = dragOverSlot?.member?.id === member.id && dragOverSlot?.time === time;
                                                    // Show drop indicator if drag position is in this slot (handles cross-slot dragging)
                                                    // Hidden: const showDropIndicator = dragPosition && dragPosition.member.id === member.id && dragPosition.time === time;
                                                    const showDropIndicator = false; // Hide drop indicator while dragging

                                                    // wouldOverlap is already calculated above, before the appointment rendering check
                                                    // This ensures the dragged appointment doesn't show in occupied slots, preventing the "dancing" effect
                                                    // Log when occupied slot is detected during drag
                                                    if (wouldOverlap && draggedAppointment) {
                                                        console.log('🟠 OCCUPIED SLOT DETECTED - During drag:', {
                                                            draggedAppointmentId: draggedAppointment.id,
                                                            member: member.name,
                                                            slot: time
                                                        });
                                                    }

                                                    // Calculate preview time for drop indicator
                                                    // This MUST match exactly with the drop indicator line position (dragPosition.offsetY)
                                                    let previewTime = null;
                                                    if (showDropIndicator && draggedAppointment && dragPosition) {
                                                        const slotStartTime = parse(time, 'HH:mm', selectedDate);
                                                        // Use the exact offsetMinutes from dragPosition - this is already clamped to 0-30 and rounded to 5-minute intervals
                                                        const offsetMinutes = dragPosition.offsetMinutes; // Values: 0, 5, 10, 15, 20, 25, 30
                                                        const calculatedTime = addMinutes(slotStartTime, offsetMinutes);
                                                        previewTime = format(calculatedTime, 'HH:mm');
                                                    }

                                                    return (
                                                        <motion.div
                                                            key={`${member.id}-${time}`}
                                                            className={`h-[60px] border-r border-b border-gray-200 relative p-1.5 transition-colors ${isHourMark ? 'bg-gray-50/30' : 'bg-white'
                                                                } ${isPastSlot ? 'bg-gray-100/50 opacity-60' : 'hover:bg-pink-50/30'} ${isDragOver && !wouldOverlap ? 'bg-[#008000]/20 border-2 border-[#008000] border-dashed' : ''
                                                                } ${isDragOver && wouldOverlap ? 'bg-red-100/50 border-2 border-red-400 border-dashed' : ''
                                                                }`}
                                                            onDragOver={(e) => {
                                                                if (!isPastSlot) {
                                                                    handleDragOver(e, member, time);
                                                                }
                                                            }}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => {
                                                                console.log('🟣 ON DROP EVENT FIRED:', {
                                                                    member: member.name,
                                                                    time: time,
                                                                    isPastSlot: isPastSlot,
                                                                    wouldOverlap: wouldOverlap
                                                                });

                                                                // Always call handleDrop if not past slot
                                                                // The handleDrop function will do its own overlap check and revert if needed
                                                                if (!isPastSlot) {
                                                                    e.preventDefault(); // Ensure we can handle the drop
                                                                    e.stopPropagation(); // Prevent event bubbling
                                                                    handleDrop(e, member, time);
                                                                } else {
                                                                    console.log('🟣 Drop prevented - past slot');
                                                                }
                                                            }}
                                                        >
                                                            {/* Show "Occupied" message when dragging over an occupied slot */}
                                                            {wouldOverlap && draggedAppointment && dragPosition && dragPosition.member?.id === member.id && dragPosition.time === time && (
                                                                <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-40 bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-semibold whitespace-nowrap animate-pulse">
                                                                    Occupied
                                                                </div>
                                                            )}
                                                            {showDropIndicator && (
                                                                <>
                                                                    {/* Drop indicator line at the TOP of where appointment will be placed */}
                                                                    <div
                                                                        className={`absolute left-0 right-0 border-t-2 border-dashed z-30 pointer-events-none ${wouldOverlap ? 'border-red-400' : 'border-[#008000]'
                                                                            }`}
                                                                        style={{ top: `${dragPosition.offsetY}px` }}
                                                                    >
                                                                        {/* Left arrow pointing to the TOP of the appointment */}
                                                                        <div className={`absolute -left-2 top-0 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-4 ${wouldOverlap ? 'border-r-red-400' : 'border-r-[#008000]'
                                                                            }`} style={{ transform: 'translateY(-50%)' }}></div>
                                                                        {/* Right arrow pointing to the TOP of the appointment */}
                                                                        <div className={`absolute -right-2 top-0 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-4 ${wouldOverlap ? 'border-l-red-400' : 'border-l-[#008000]'
                                                                            }`} style={{ transform: 'translateY(-50%)' }}></div>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {!appointmentAtSlot && (
                                                                <motion.button
                                                                    whileHover={!isPastSlot ? { scale: 1.02, backgroundColor: 'rgba(236, 72, 153, 0.1)' } : {}}
                                                                    whileTap={!isPastSlot ? { scale: 0.98 } : {}}
                                                                    onClick={() => handleSlotClick(member, time)}
                                                                    disabled={isPastSlot}
                                                                    className={`w-full h-full flex flex-col items-center justify-center transition-all rounded-lg border-2 border-dashed ${isPastSlot
                                                                        ? 'border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                                                                        : 'border-transparent text-gray-400 hover:border-pink-300 hover:text-pink-500 group-hover:opacity-100'
                                                                        }`}
                                                                >
                                                                    <Plus className={`w-4 h-4 transition-opacity ${isPastSlot ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`} />
                                                                    {!isPastSlot && (
                                                                        <span className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity truncate w-full px-1">
                                                                            {member.name}
                                                                        </span>
                                                                    )}
                                                                </motion.button>
                                                            )}

                                                            {isStartOfBooking && (() => {
                                                                const appointmentStyle = getAppointmentStyle(appointmentAtSlot, slotStartTime);
                                                                const bufferTime = appointmentAtSlot.services?.buffer_time || 0;
                                                                const hasBufferTime = bufferTime > 0;
                                                                const memberColor = getMemberColor(appointmentAtSlot.team_member_id);

                                                                // Calculate arrow position - it should always point to the TOP of the appointment
                                                                // When dragging, the arrow should be at top: 0 (the top edge of the appointment)
                                                                // This ensures it points to the exact start time, not the middle
                                                                const isDragging = draggedAppointment?.id === appointmentAtSlot.id;

                                                                // When dragging, calculate the new position based on dragPosition
                                                                // This makes the appointment visually snap to each 5-minute interval as you drag
                                                                let displayTop = appointmentStyle.top;
                                                                let displayHeight = appointmentStyle.height;

                                                                // Check if this appointment is being dragged and we have a drag position for this slot
                                                                // This makes the appointment visually move to each 5-minute interval position
                                                                if (isDragging && dragPosition &&
                                                                    dragPosition.member?.id === member.id &&
                                                                    dragPosition.time === time) {
                                                                    // Use the drag position to show where the appointment will be placed
                                                                    // This makes it snap to each 5-minute interval (0, 5, 10, 15, 20, 25, 30) as you drag
                                                                    displayTop = `${dragPosition.offsetY}px`;
                                                                    // Keep the same height (duration doesn't change when dragging)
                                                                    displayHeight = appointmentStyle.height;
                                                                }

                                                                return (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                                                        animate={{
                                                                            opacity: isDragging ? 0.5 : 1,
                                                                            scale: 1,
                                                                            y: 0
                                                                        }}
                                                                        transition={{ duration: isDragging ? 0.1 : 0.2 }}
                                                                        className={`absolute left-1.5 right-1.5 rounded-lg overflow-visible cursor-move transition-all shadow-md hover:shadow-xl ${isDragging ? 'z-10' : 'z-20'
                                                                            }`}
                                                                        style={{
                                                                            height: displayHeight,
                                                                            top: displayTop
                                                                        }}
                                                                        draggable={!isPastSlot && appointmentAtSlot.type !== 'blocked'}
                                                                        onDragStart={(e) => !isPastSlot && appointmentAtSlot.type !== 'blocked' && handleDragStart(e, appointmentAtSlot)}
                                                                        onDragEnd={handleDragEnd}
                                                                        onClick={() => {
                                                                            // Don't open dialog for blocked slots - only delete button works
                                                                            if (appointmentAtSlot.type !== 'blocked') {
                                                                                handleAppointmentClick(appointmentAtSlot);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {/* Position arrow pointing to time column at the TOP of the appointment (start time) */}
                                                                        {/* The arrow is positioned exactly at the top edge (0px) to point to the exact start time */}
                                                                        {isDragging && (
                                                                            <div
                                                                                className="absolute -left-3 z-50 pointer-events-none"
                                                                                style={{
                                                                                    top: '0px' // Exactly at the top edge of the appointment - this is where the start time is
                                                                                }}
                                                                            >
                                                                                {/* Arrow pointing left toward time column, centered on the top edge */}
                                                                                <div
                                                                                    className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-4 border-r-[#008000]"
                                                                                    style={{
                                                                                        transform: 'translateY(-50%)' // Center the arrow vertically on the top edge line
                                                                                    }}
                                                                                ></div>
                                                                            </div>
                                                                        )}
                                                                        {appointmentAtSlot.type === 'blocked' ? (
                                                                            <div className="h-full bg-gray-200 border border-gray-300 text-gray-700 hover:bg-gray-300 p-2.5">
                                                                                <div className="flex items-center gap-1.5 h-full">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <span className="font-bold text-gray-900">Blocked</span>
                                                                                        {appointmentAtSlot.reason && (
                                                                                            <div className="truncate text-xs text-gray-600 mt-0.5">
                                                                                                {appointmentAtSlot.reason}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={(e) => handleDeleteBlockedTime(appointmentAtSlot, e)}
                                                                                        className="ml-auto flex-shrink-0 p-1 hover:bg-red-500 hover:text-white rounded transition-colors group"
                                                                                        title="Unblock time"
                                                                                        aria-label="Unblock time"
                                                                                    >
                                                                                        <X className="w-3.5 h-3.5 text-gray-600 group-hover:text-white" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="h-full flex flex-col">
                                                                                {/* Service Duration (Member Color) */}
                                                                                <div
                                                                                    className={`p-2.5 text-xs border text-white shadow-lg ${hasBufferTime ? 'rounded-t-lg' : 'rounded-lg'
                                                                                        }`}
                                                                                    style={{
                                                                                        height: hasBufferTime ? appointmentStyle.serviceHeight : '100%',
                                                                                        minHeight: '40px',
                                                                                        backgroundColor: memberColor.bg,
                                                                                        borderColor: memberColor.border,
                                                                                        boxShadow: `0 4px 6px -1px ${memberColor.bg}20`
                                                                                    }}
                                                                                    onMouseEnter={(e) => {
                                                                                        e.currentTarget.style.backgroundColor = memberColor.hover;
                                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                                        setHoveredAppointment(appointmentAtSlot);
                                                                                        setTooltipPosition({
                                                                                            x: rect.right + 10,
                                                                                            y: rect.top
                                                                                        });
                                                                                    }}
                                                                                    onMouseLeave={(e) => {
                                                                                        e.currentTarget.style.backgroundColor = memberColor.bg;
                                                                                        setHoveredAppointment(null);
                                                                                    }}
                                                                                    onMouseMove={(e) => {
                                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                                        setTooltipPosition({
                                                                                            x: rect.right + 10,
                                                                                            y: rect.top
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    <div className="space-y-1 h-full flex flex-col justify-between">
                                                                                        <div>
                                                                                            <div className="font-bold text-sm truncate leading-tight">
                                                                                                {appointmentAtSlot.client_name || appointmentAtSlot.clients?.name || 'Client'}
                                                                                            </div>
                                                                                            <div className="flex items-center gap-1.5 text-xs opacity-90 mt-1">
                                                                                                <span className="truncate">
                                                                                                    {appointmentAtSlot.services?.name || 'Service'}
                                                                                                </span>
                                                                                                <span className="opacity-60">•</span>
                                                                                                <span className="font-medium">
                                                                                                    {format(parseISO(appointmentAtSlot.start_time), 'HH:mm')}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                        {appointmentAtSlot.notes && (
                                                                                            <div className="text-xs opacity-75 truncate mt-1 italic">
                                                                                                {appointmentAtSlot.notes}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                {/* Buffer Time (Red) */}
                                                                                {hasBufferTime && (
                                                                                    <div
                                                                                        className="bg-red-500 border-t border-red-600 text-white p-1.5 text-xs rounded-b-lg flex items-center justify-center"
                                                                                        style={{
                                                                                            height: appointmentStyle.bufferHeight,
                                                                                            minHeight: '20px'
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex items-center gap-1">
                                                                                            <span className="font-semibold">Buffer:</span>
                                                                                            <span>{bufferTime} min</span>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </motion.div>
                                                                );
                                                            })()}
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}

                                    {/* Current Time Indicator */}
                                    {isToday(selectedDate) && timeIndicatorTop !== null && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                                            style={{ top: `${timeIndicatorTop + 128}px` }}
                                        >
                                            <div className="absolute left-0 right-0 h-0.5 bg-[#008000]"></div>
                                            <div className="flex items-center gap-2 ml-0">
                                                <div className="w-3 h-3 bg-[#008000] rounded-full shadow-lg shadow-[#008000]/50 ring-2 ring-white"></div>
                                                <div className="text-xs font-semibold bg-[#008000] text-white px-2 py-0.5 rounded-full shadow-md">
                                                    {format(currentTime, 'HH:mm')}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Appointment Details Tooltip */}
                                    {hoveredAppointment && hoveredAppointment.type !== 'blocked' && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="fixed z-[100] bg-white border-2 border-gray-200 rounded-lg shadow-2xl p-4 min-w-[280px] max-w-[320px] pointer-events-none"
                                            style={{
                                                left: `${tooltipPosition.x}px`,
                                                top: `${tooltipPosition.y}px`,
                                                transform: 'translateY(0)'
                                            }}
                                        >
                                            <div className="space-y-3">
                                                {/* Client Name */}
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                        <UserIcon className="w-3 h-3" />
                                                        <span>Client</span>
                                                    </div>
                                                    <div className="font-bold text-base text-gray-900">
                                                        {hoveredAppointment.client_name || hoveredAppointment.clients?.name || 'No Client'}
                                                    </div>
                                                    {hoveredAppointment.clients?.phone && (
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            {hoveredAppointment.clients.phone}
                                                        </div>
                                                    )}
                                                    {hoveredAppointment.clients?.email && (
                                                        <div className="text-sm text-gray-600">
                                                            {hoveredAppointment.clients.email}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Divider */}
                                                <div className="border-t border-gray-200"></div>

                                                {/* Service */}
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                        <CalendarIcon className="w-3 h-3" />
                                                        <span>Service</span>
                                                    </div>
                                                    <div className="font-semibold text-sm text-gray-900">
                                                        {hoveredAppointment.services?.name || 'No Service'}
                                                    </div>
                                                    {hoveredAppointment.services?.duration && (
                                                        <div className="text-xs text-gray-600 mt-1">
                                                            Duration: {hoveredAppointment.services.duration} min
                                                        </div>
                                                    )}
                                                    {hoveredAppointment.services?.price && (
                                                        <div className="text-xs text-gray-600">
                                                            Price: £{parseFloat(hoveredAppointment.services.price).toFixed(2)}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Divider */}
                                                <div className="border-t border-gray-200"></div>

                                                {/* Time */}
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span>Time</span>
                                                    </div>
                                                    <div className="text-sm text-gray-900 font-medium">
                                                        {format(parseISO(hoveredAppointment.start_time), 'HH:mm')} - {format(parseISO(hoveredAppointment.end_time), 'HH:mm')}
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-1">
                                                        {format(parseISO(hoveredAppointment.start_time), 'EEEE, MMMM d, yyyy')}
                                                    </div>
                                                </div>

                                                {/* Team Member */}
                                                {hoveredAppointment.team_members && (
                                                    <>
                                                        <div className="border-t border-gray-200"></div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                                <UserIcon className="w-3 h-3" />
                                                                <span>Team Member</span>
                                                            </div>
                                                            <div className="text-sm text-gray-900 font-medium">
                                                                {hoveredAppointment.team_members.name}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Notes */}
                                                {hoveredAppointment.notes && (
                                                    <>
                                                        <div className="border-t border-gray-200"></div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-1">Notes</div>
                                                            <div className="text-sm text-gray-700 italic">
                                                                {hoveredAppointment.notes}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Team Member Details Tooltip */}
                                    {hoveredTeamMember && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="fixed z-[100] bg-white border-2 border-gray-200 rounded-lg shadow-2xl p-4 min-w-[280px] max-w-[320px] pointer-events-none"
                                            style={{
                                                left: `${teamMemberTooltipPosition.x}px`,
                                                top: `${teamMemberTooltipPosition.y}px`,
                                                maxHeight: `${Math.min(400, window.innerHeight - teamMemberTooltipPosition.y - 20)}px`,
                                                overflowY: 'auto',
                                                maxWidth: `${Math.min(320, window.innerWidth - teamMemberTooltipPosition.x - 20)}px`
                                            }}
                                        >
                                            <div className="space-y-3">
                                                {/* Team Member Name & Image */}
                                                <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                                                    <img
                                                        src={hoveredTeamMember.image_url || `https://ui-avatars.com/api/?name=${hoveredTeamMember.name}&background=008000&color=ffffff&size=128`}
                                                        alt={hoveredTeamMember.name}
                                                        className="w-16 h-16 rounded-full border-2 border-gray-200 object-cover"
                                                        onError={(e) => {
                                                            e.target.src = `https://ui-avatars.com/api/?name=${hoveredTeamMember.name.replace(' ', '+')}&background=008000&color=ffffff&size=128`;
                                                        }}
                                                    />
                                                    <div>
                                                        <div className="font-bold text-lg text-gray-900">
                                                            {hoveredTeamMember.name}
                                                        </div>
                                                        {hoveredTeamMember.job_title && (
                                                            <div className="text-sm text-gray-600 mt-1">
                                                                {hoveredTeamMember.job_title}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Contact Information */}
                                                {(hoveredTeamMember.email || hoveredTeamMember.phone) && (
                                                    <>
                                                        <div className="border-t border-gray-200"></div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                                <UserIcon className="w-3 h-3" />
                                                                <span>Contact</span>
                                                            </div>
                                                            {hoveredTeamMember.email && (
                                                                <div className="text-sm text-gray-900 mb-1">
                                                                    {hoveredTeamMember.email}
                                                                </div>
                                                            )}
                                                            {hoveredTeamMember.phone && (
                                                                <div className="text-sm text-gray-900">
                                                                    {hoveredTeamMember.phone}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {/* Working Days */}
                                                {hoveredTeamMember.working_days && hoveredTeamMember.working_days.length > 0 && (
                                                    <>
                                                        <div className="border-t border-gray-200"></div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                                <CalendarIcon className="w-3 h-3" />
                                                                <span>Working Days</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {(() => {
                                                                    let workingDays = hoveredTeamMember.working_days;
                                                                    if (typeof workingDays === 'string') {
                                                                        workingDays = workingDays.split(',').map(day => day.trim()).filter(day => day.length > 0);
                                                                    }
                                                                    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                                                                    return daysOfWeek.map(day => {
                                                                        const isWorking = Array.isArray(workingDays) && workingDays.includes(day);
                                                                        return (
                                                                            <span
                                                                                key={day}
                                                                                className={`px-2 py-1 rounded text-xs font-medium ${isWorking
                                                                                    ? 'bg-[#008000] text-white'
                                                                                    : 'bg-gray-100 text-gray-500'
                                                                                    }`}
                                                                            >
                                                                                {day.substring(0, 3)}
                                                                            </span>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Description */}
                                                {hoveredTeamMember.description && (
                                                    <>
                                                        <div className="border-t border-gray-200"></div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-1">Description</div>
                                                            <div className="text-sm text-gray-700">
                                                                {hoveredTeamMember.description}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Pricing Information */}
                                                {(hoveredTeamMember.default_hourly_rate || hoveredTeamMember.commission_percentage) && (
                                                    <>
                                                        <div className="border-t border-gray-200"></div>
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                                <DollarSign className="w-3 h-3" />
                                                                <span>Pricing</span>
                                                            </div>
                                                            {hoveredTeamMember.default_hourly_rate && (
                                                                <div className="text-sm text-gray-900 mb-1">
                                                                    Hourly Rate: ${parseFloat(hoveredTeamMember.default_hourly_rate).toFixed(2)}
                                                                </div>
                                                            )}
                                                            {hoveredTeamMember.commission_percentage && (
                                                                <div className="text-sm text-gray-900">
                                                                    Commission: {parseFloat(hoveredTeamMember.commission_percentage).toFixed(1)}%
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        ) : teamMembers.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-gray-500">
                                <div className="text-center max-w-md">
                                    <Ban className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-semibold mb-2">No Team Members Found</p>
                                    <p className="text-sm mb-4">No team members found for <span className="font-semibold">{currentShop?.name}</span>.</p>
                                    <div className="text-xs text-gray-400 space-y-1">
                                        <p>To fix this:</p>
                                        <ol className="list-decimal list-inside space-y-1 text-left max-w-xs mx-auto">
                                            <li>Go to <span className="font-semibold">Team Management</span></li>
                                            <li>Add team members</li>
                                            <li>Assign them to this shop</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-500">
                                <div className="text-center max-w-md">
                                    <Ban className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-semibold mb-2">No Team Members Working</p>
                                    <p className="text-sm mb-4">No team members are scheduled to work on <span className="font-semibold">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>.</p>
                                    <div className="text-xs text-gray-400 space-y-1">
                                        <p>To fix this:</p>
                                        <ol className="list-decimal list-inside space-y-1 text-left max-w-xs mx-auto">
                                            <li>Go to <span className="font-semibold">Team Management</span></li>
                                            <li>Edit team members' working days</li>
                                            <li>Add <span className="font-semibold">{format(selectedDate, 'EEEE')}</span> to their schedule</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Appointment Dialog */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} modal={false}>
                        <DialogContent className="bg-white border-gray-200 text-gray-900 max-h-[80vh] overflow-y-auto shadow-2xl z-50">
                            <DialogHeader>
                                <DialogTitle className="text-2xl">
                                    {editingAppointment ? 'Edit Event' : 'Create Event'}
                                </DialogTitle>
                                <DialogDescription>
                                    {editingAppointment
                                        ? 'Update the appointment details below.'
                                        : appointmentType === 'blocked'
                                            ? 'Block a time slot to prevent bookings.'
                                            : 'Create a new appointment by filling in the details below.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Staff</Label>
                                    <Select
                                        value={formData.team_member_id || ''}
                                        onValueChange={(value) => setFormData({ ...formData, team_member_id: value })}
                                    >
                                        <SelectTrigger className="bg-white border-gray-200 text-gray-700">
                                            <SelectValue placeholder="Select Staff" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white border-gray-200 text-gray-900">
                                            {teamMembers.map(member => (
                                                <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Appointment Type Selection */}
                                <div className="space-y-2">
                                    <Label className="text-base font-semibold text-gray-900">Options</Label>
                                    <div className="space-y-2">
                                        {/* Appointment Option */}
                                        <label className="flex items-center space-x-2 cursor-pointer group p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                            <input
                                                type="radio"
                                                name="appointmentType"
                                                value="appointment"
                                                checked={appointmentType === 'appointment'}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAppointmentType('appointment');
                                                        // Reset form data for appointment
                                                        if (selectedSlot) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                start_time: selectedSlot.time,
                                                                team_member_id: selectedSlot.member.id,
                                                                date: selectedSlot.date,
                                                                client_id: '',
                                                                service_id: ''
                                                            }));
                                                        }
                                                    }
                                                }}
                                                className="w-4 h-4 text-[#008000] border-gray-300 focus:ring-[#008000] focus:ring-2 cursor-pointer"
                                            />
                                            <div className="flex items-center space-x-2">
                                                <CalendarIcon className={`w-4 h-4 ${appointmentType === 'appointment' ? 'text-[#008000]' : 'text-gray-400'}`} />
                                                <span className={`text-sm font-medium transition-colors ${appointmentType === 'appointment'
                                                    ? 'text-[#008000]'
                                                    : 'text-gray-600 group-hover:text-gray-900'
                                                    }`}>
                                                    Appointment
                                                </span>
                                            </div>
                                        </label>

                                        {/* Block Time Option */}
                                        <label className="flex items-center space-x-2 cursor-pointer group p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                            <input
                                                type="radio"
                                                name="appointmentType"
                                                value="blocked"
                                                checked={appointmentType === 'blocked'}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAppointmentType('blocked');
                                                        // Auto-fill the slot time if a slot was selected
                                                        if (selectedSlot) {
                                                            const slotTime = parse(selectedSlot.time, 'HH:mm', selectedDate);
                                                            const defaultEndTime = addMinutes(slotTime, 30); // Default 30 minutes block
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                start_time: selectedSlot.time,
                                                                end_time: format(defaultEndTime, 'HH:mm'),
                                                                team_member_id: selectedSlot.member.id,
                                                                date: selectedSlot.date,
                                                                client_id: '',
                                                                service_id: ''
                                                            }));
                                                        }
                                                    }
                                                }}
                                                className="w-4 h-4 text-[#008000] border-gray-300 focus:ring-[#008000] focus:ring-2 cursor-pointer"
                                            />
                                            <div className="flex items-center space-x-2">
                                                <Clock className={`w-4 h-4 ${appointmentType === 'blocked' ? 'text-[#008000]' : 'text-gray-400'}`} />
                                                <span className={`text-sm font-medium transition-colors ${appointmentType === 'blocked'
                                                    ? 'text-[#008000]'
                                                    : 'text-gray-600 group-hover:text-gray-900'
                                                    }`}>
                                                    Block Time
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {appointmentType === 'appointment' ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Date</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant={"outline"} className="w-full justify-start text-left font-normal bg-white border-gray-200 text-gray-700 hover:bg-white/20">
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 bg-white border-gray-200 shadow-lg">
                                                        <DayPicker
                                                            mode="single"
                                                            selected={formData.date}
                                                            onSelect={(date) => date && setFormData({ ...formData, date })}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Start Time</Label>
                                                <Input
                                                    type="time"
                                                    value={formData.start_time || ''}
                                                    onChange={(e) => {
                                                        const timeValue = e.target.value;
                                                        // Ensure format is HH:mm (no seconds)
                                                        if (timeValue && timeValue.length === 5) {
                                                            setFormData({ ...formData, start_time: timeValue });
                                                        } else if (timeValue) {
                                                            // If browser adds seconds, remove them
                                                            const timeWithoutSeconds = timeValue.substring(0, 5);
                                                            setFormData({ ...formData, start_time: timeWithoutSeconds });
                                                        } else {
                                                            setFormData({ ...formData, start_time: '' });
                                                        }
                                                    }}
                                                    className="bg-white border-gray-200 text-gray-700"
                                                    step="60"
                                                />
                                                <p className="text-xs text-gray-500">Enter hour and minute (e.g., 09:15, 10:30, 14:45). End time will be calculated automatically based on service duration.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Client</Label>
                                            <div className="flex gap-2">
                                                <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={clientSearchOpen}
                                                            className="flex-1 justify-between bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                                        >
                                                            <span className="truncate">
                                                                {formData.client_id
                                                                    ? clients.find(c => c.id === formData.client_id)?.name || 'Select client'
                                                                    : 'Search or select client...'}
                                                            </span>
                                                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-[400px] p-0 bg-white border-gray-200"
                                                        align="start"
                                                        style={{ zIndex: 9999, pointerEvents: 'auto' }}
                                                        onInteractOutside={(e) => {
                                                            // Prevent closing when clicking outside if it's the dialog overlay
                                                            const target = e.target;
                                                            if (target && target.closest && target.closest('[role="dialog"]')) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                    >
                                                        <Command
                                                            className="bg-white"
                                                            shouldFilter={false}
                                                        >
                                                            <CommandInput
                                                                placeholder="Search clients by name, phone, or email..."
                                                                className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                                                                value={clientSearchQuery}
                                                                onValueChange={setClientSearchQuery}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>No client found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {clients
                                                                        .filter((client) => {
                                                                            if (!clientSearchQuery.trim()) return true;

                                                                            const query = clientSearchQuery.toLowerCase();
                                                                            return (
                                                                                client.name.toLowerCase().includes(query) ||
                                                                                client.phone?.toLowerCase().includes(query) ||
                                                                                client.email?.toLowerCase().includes(query)
                                                                            );
                                                                        })
                                                                        .map((client) => {
                                                                            const isSelected = formData.client_id === client.id;

                                                                            const handleClientSelect = () => {
                                                                                setFormData(prev => ({ ...prev, client_id: client.id }));
                                                                                setClientSearchOpen(false);
                                                                                setClientSearchQuery('');
                                                                            };

                                                                            return (
                                                                                <CommandItem
                                                                                    key={client.id}
                                                                                    value={client.id.toString()}
                                                                                    onSelect={handleClientSelect}
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        handleClientSelect();
                                                                                    }}
                                                                                    className={cn(
                                                                                        "cursor-pointer hover:bg-gray-100 text-gray-900 aria-selected:bg-gray-100",
                                                                                        isSelected && "bg-gray-100"
                                                                                    )}
                                                                                >
                                                                                    <Check
                                                                                        className={cn(
                                                                                            "mr-2 h-4 w-4",
                                                                                            isSelected ? "opacity-100" : "opacity-0"
                                                                                        )}
                                                                                    />
                                                                                    <div className="flex flex-col flex-1">
                                                                                        <span className="font-medium text-gray-900">{client.name}</span>
                                                                                        {(client.phone || client.email) && (
                                                                                            <span className="text-xs text-gray-500">
                                                                                                {client.phone || ''} {client.email ? `• ${client.email}` : ''}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </CommandItem>
                                                                            );
                                                                        })}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setIsCreatingClient(true);
                                                    }}
                                                    className="bg-[#008000] hover:bg-[#006600] text-white border-[#008000]"
                                                >
                                                    <UserPlus className="h-4 w-4 mr-2" />
                                                    New Client
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Create New Client Dialog */}
                                        <Dialog
                                            open={isCreatingClient}
                                            onOpenChange={(open) => {
                                                if (open) {
                                                    setIsCreatingClient(true);
                                                } else {
                                                    // Only allow closing if not currently creating
                                                    if (!isCreatingClientLoading) {
                                                        setIsCreatingClient(false);
                                                        setNewClientData({ name: '', phone: '', email: '' });
                                                    }
                                                }
                                            }}
                                        >
                                            <DialogContent className="bg-white border-gray-200 text-gray-900 z-[100]">
                                                <DialogHeader>
                                                    <DialogTitle>Create New Client</DialogTitle>
                                                    <DialogDescription>
                                                        Add a new client to the system. Name is required.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label>Client Name *</Label>
                                                        <Input
                                                            value={newClientData.name}
                                                            onChange={(e) => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                                                            placeholder="Enter client name"
                                                            className="bg-white border-gray-200 text-gray-700"
                                                            autoFocus
                                                            disabled={isCreatingClientLoading}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Phone (Optional)</Label>
                                                            <Input
                                                                value={newClientData.phone}
                                                                onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                                                                placeholder="Phone number"
                                                                className="bg-white border-gray-200 text-gray-700"
                                                                disabled={isCreatingClientLoading}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Email (Optional)</Label>
                                                            <Input
                                                                value={newClientData.email}
                                                                onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                                                                placeholder="Email address"
                                                                type="email"
                                                                className="bg-white border-gray-200 text-gray-700"
                                                                disabled={isCreatingClientLoading}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => {
                                                            if (!isCreatingClientLoading) {
                                                                setIsCreatingClient(false);
                                                                setNewClientData({ name: '', phone: '', email: '' });
                                                            }
                                                        }}
                                                        disabled={isCreatingClientLoading}
                                                        className="border-gray-200"
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        onClick={handleCreateNewClient}
                                                        disabled={isCreatingClientLoading || !newClientData.name.trim()}
                                                        className="bg-[#008000] hover:bg-[#006600] text-white disabled:opacity-50"
                                                    >
                                                        {isCreatingClientLoading ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Creating...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserPlus className="mr-2 h-4 w-4" />
                                                                Create Client
                                                            </>
                                                        )}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        <div className="space-y-2">
                                            <Label>Service</Label>
                                            <Select
                                                value={formData.service_id || ''}
                                                onValueChange={(value) => setFormData({ ...formData, service_id: value })}
                                            >
                                                <SelectTrigger className="bg-white border-gray-200 text-gray-700">
                                                    <SelectValue placeholder="Select a service" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white border-gray-200 text-gray-900">
                                                    {services.map(s => (
                                                        <SelectItem key={s.id} value={s.id}>
                                                            {s.name} ({s.duration} min)
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Date</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant={"outline"} className="w-full justify-start text-left font-normal bg-white border-gray-200 text-gray-700 hover:bg-white/20">
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 bg-white border-gray-200 shadow-lg">
                                                    <DayPicker
                                                        mode="single"
                                                        selected={formData.date}
                                                        onSelect={(date) => date && setFormData({ ...formData, date })}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Start Time</Label>
                                                <Input
                                                    type="time"
                                                    value={formData.start_time || ''}
                                                    onChange={(e) => {
                                                        const timeValue = e.target.value;
                                                        // Ensure format is HH:mm (no seconds)
                                                        if (timeValue && timeValue.length === 5) {
                                                            setFormData({ ...formData, start_time: timeValue });
                                                        } else if (timeValue) {
                                                            // If browser adds seconds, remove them
                                                            const timeWithoutSeconds = timeValue.substring(0, 5);
                                                            setFormData({ ...formData, start_time: timeWithoutSeconds });
                                                        } else {
                                                            setFormData({ ...formData, start_time: '' });
                                                        }
                                                    }}
                                                    className="bg-white border-gray-200 text-gray-700"
                                                    step="60"
                                                />
                                                <p className="text-xs text-gray-500">Enter hour and minute (e.g., 09:15, 10:30)</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End Time</Label>
                                                <Input
                                                    type="time"
                                                    value={formData.end_time || ''}
                                                    onChange={(e) => {
                                                        const timeValue = e.target.value;
                                                        // Ensure format is HH:mm (no seconds)
                                                        if (timeValue && timeValue.length === 5) {
                                                            setFormData({ ...formData, end_time: timeValue });
                                                        } else if (timeValue) {
                                                            // If browser adds seconds, remove them
                                                            const timeWithoutSeconds = timeValue.substring(0, 5);
                                                            setFormData({ ...formData, end_time: timeWithoutSeconds });
                                                        } else {
                                                            setFormData({ ...formData, end_time: '' });
                                                        }
                                                    }}
                                                    disabled={!formData.start_time}
                                                    className="bg-white border-gray-200 text-gray-700 disabled:opacity-50"
                                                    step="60"
                                                    min={formData.start_time || undefined}
                                                />
                                                <p className="text-xs text-gray-500">Must be after start time</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Reason</Label>
                                            <Input
                                                value={formData.reason}
                                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                                placeholder="e.g., Bank visit, Personal appointment"
                                                className="bg-white border-gray-200 text-gray-700"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    {editingAppointment && (
                                        <Button
                                            variant="destructive"
                                            onClick={handleDeleteAppointment}
                                            className="flex-1"
                                        >
                                            <Trash className="mr-2 h-4 w-4" />
                                            {editingAppointment.type === 'blocked' ? 'Unblock' : 'Delete'}
                                        </Button>
                                    )}
                                    <Button
                                        onClick={handleSaveAppointment}
                                        disabled={isSaveDisabled}
                                        className="w-full bg-[#008000] hover:bg-[#006600] disabled:bg-gray-500 text-white"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : appointmentType === 'blocked' ? (
                                            editingAppointment ? "Update Block" : "Save Block"
                                        ) : (
                                            editingAppointment ? "Update Booking" : "Save Booking"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </Layout>
    );
};

export default CalendarPage;