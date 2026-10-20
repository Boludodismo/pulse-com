import {mysqlTable,int,varchar,tinyint,datetime} from 'drizzle-orm/mysql-core';
export const clientWhatsappPermissions=mysqlTable('client_whatsapp_permissions',{
 studioId:int('studio_id').notNull(),clientId:int('client_id').notNull(),normalizedPhone:varchar('normalized_phone',{length:24}).notNull(),enabled:tinyint().notNull(),source:varchar({length:100}).notNull(),recordedAt:datetime('recorded_at',{mode:'string'}).notNull(),
});
export const appointmentAttendance=mysqlTable('appointment_attendance',{
 appointmentId:int('appointment_id').primaryKey(),studioId:int('studio_id').notNull(),clientId:int('client_id').notNull(),artistId:int('artist_id'),attendance:varchar({length:12}).notNull(),session:varchar({length:16}).notNull(),needsMore:tinyint('needs_more').notNull(),
});
