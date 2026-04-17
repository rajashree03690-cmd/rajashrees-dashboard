import { supabase } from '@/lib/supabase';

export interface Banner {
    banner_id: string; // UUID
    title: string;
    subtitle: string | null;
    image_url: string;
    redirect_url: string | null;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    banner_type: string | null;   // hero, promotional, collection, sidebar, popup
    placement: string | null;     // homepage_top, between_products, shop_sidebar, etc.
    display_order: number | null;
    cta_text: string | null;
    target_pages: string[] | null;
    created_at: string;
    updated_at: string;
}

export async function fetchBanners(): Promise<Banner[]> {
    try {
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching banners:', error);
        return [];
    }
}

export async function addBanner(banner: Partial<Banner>): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('banners')
            .insert([banner]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error adding banner:', error);
        return false;
    }
}

export async function updateBanner(
    bannerId: string,
    updates: Partial<Banner>
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('banners')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('banner_id', bannerId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating banner:', error);
        return false;
    }
}

export async function deleteBanner(bannerId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('banners')
            .delete()
            .eq('banner_id', bannerId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting banner:', error);
        return false;
    }
}

export async function toggleBannerStatus(
    bannerId: string,
    isActive: boolean
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('banners')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('banner_id', bannerId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error toggling banner status:', error);
        return false;
    }
}

export async function uploadBannerImage(file: File): Promise<{ url?: string; error?: string }> {
    try {
        const fileName = `banner_${Date.now()}.${file.name.split('.').pop()}`;

        const { data, error } = await supabase.storage
            .from('banners')
            .upload(fileName, file, { upsert: true });

        if (error) {
            console.error('Banner image upload failed:', error);
            return { error: error.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('banners')
            .getPublicUrl(fileName);

        return { url: publicUrl };
    } catch (error) {
        console.error('Banner upload error:', error);
        return { error: String(error) };
    }
}

export async function uploadCategoryImage(file: File, categoryName: string): Promise<{ url?: string; error?: string }> {
    try {
        const sanitized = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fileName = `${sanitized}_${Date.now()}.${file.name.split('.').pop()}`;

        const { data, error } = await supabase.storage
            .from('category-images')
            .upload(fileName, file, { upsert: true });

        if (error) {
            console.error('Category image upload failed:', error);
            return { error: error.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('category-images')
            .getPublicUrl(fileName);

        return { url: publicUrl };
    } catch (error) {
        console.error('Category image upload error:', error);
        return { error: String(error) };
    }
}
