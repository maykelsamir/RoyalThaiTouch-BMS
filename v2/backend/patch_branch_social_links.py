from pathlib import Path

branches_path = Path('/app/app/api/routes/branches.py')
branches = branches_path.read_text(encoding='utf-8')
anchor = '''        whatsapp=branch.whatsapp,
        manager_name=branch.manager_name,
'''
replacement = '''        whatsapp=branch.whatsapp,
        website=branch.website,
        facebook=branch.facebook,
        instagram=branch.instagram,
        tiktok=branch.tiktok,
        youtube=branch.youtube,
        telegram=branch.telegram,
        snapchat=branch.snapchat,
        google_maps=branch.google_maps,
        manager_name=branch.manager_name,
'''
if 'website=branch.website' not in branches:
    if anchor not in branches:
        raise SystemExit('branches _view anchor not found')
    branches = branches.replace(anchor, replacement)
branches_path.write_text(branches, encoding='utf-8')

main_path = Path('/app/app/main.py')
main = main_path.read_text(encoding='utf-8')
anchor = '''            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(60) NOT NULL DEFAULT ''"))
'''
replacement = '''            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(300) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ALTER COLUMN whatsapp TYPE VARCHAR(300)"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS website VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS facebook VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS instagram VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS tiktok VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS youtube VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS telegram VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS snapchat VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS google_maps VARCHAR(1000) NOT NULL DEFAULT ''"))
'''
if 'ADD COLUMN IF NOT EXISTS website' not in main:
    if anchor not in main:
        raise SystemExit('main branch migration anchor not found')
    main = main.replace(anchor, replacement)
main_path.write_text(main, encoding='utf-8')
