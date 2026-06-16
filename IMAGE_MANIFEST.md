# Image Manifest — Badges & Marketplace

All badge and marketplace rows seed with `image_filename = NULL`, so the UI shows a **neutral
placeholder** (the item/badge initial) until art exists. Nothing breaks if a file or bucket is
missing — it just falls back to the placeholder.

To wire up art:
1. Upload the image to the matching **public storage bucket** (below).
2. Set the row's `image_filename` to the uploaded filename:
   - **Marketplace items** — use the Admin → *Marketplace Catalog* → *Edit* → `Image filename` field.
   - **Badges** — set via SQL, e.g. `UPDATE public.badges SET image_filename = 'trash_to_treasure.png' WHERE id = 'b1';`

The public URL is built as `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/<bucket>/<image_filename>`.

---

## Badges — bucket: `gamification-badges`

Suggested filenames (you can use any name; just match the `image_filename` you set):

| id  | title                | suggested filename          |
|-----|----------------------|-----------------------------|
| b1  | Trash-to-Treasure    | `trash_to_treasure.png`     |
| b2  | Sprouting Value      | `sprouting_value.png`       |
| b3  | Eco Rookie           | `eco_rookie.png`            |
| b4  | Green Momentum       | `green_momentum.png`        |
| b5  | Unstoppable Recycler | `unstoppable_recycler.png`  |
| b6  | Waste Warrior        | `waste_warrior.png`         |
| b7  | Paper Protector      | `paper_protector.png`       |
| b8  | Plastic Patrol       | `plastic_patrol.png`        |
| b9  | Metal Maverick       | `metal_maverick.png`        |
| b10 | Eco Influencer       | `eco_influencer.png`        |
| b11 | Eco Brainiac         | `eco_brainiac.png`          |
| b12 | Circular Citizen     | `circular_citizen.png`      |
| b13 | Trashium Veteran     | `trashium_veteran.png`      |
| b14 | Forest Elder         | `forest_elder.png`          |
| b15 | Planet Partner       | `planet_partner.png`        |

## Marketplace items — bucket: `marketplace-items`

| tier      | name                        | suggested filename               |
|-----------|-----------------------------|----------------------------------|
| seedling  | Sticker Pack                | `sticker_pack.png`               |
| seedling  | Eco Bookmark                | `eco_bookmark.png`               |
| seedling  | Seed Paper Card             | `seed_paper_card.png`            |
| seedling  | Eco Pouch                   | `eco_pouch.png`                  |
| sapling   | Eco Cap                     | `eco_cap.png`                    |
| sapling   | Tote Bag                    | `tote_bag.png`                   |
| sapling   | Ceramic Mug                 | `ceramic_mug.png`                |
| sapling   | Recycled Notebook           | `recycled_notebook.png`          |
| forest    | Organic Tee                 | `organic_tee.png`                |
| forest    | Forest Elder Tee            | `forest_elder_tee.png`           |
| forest    | Hoodie                      | `hoodie.png`                     |
| legendary | Forest Elder Collector Mug  | `forest_elder_collector_mug.png` |
| legendary | Planet Partner Kit          | `planet_partner_kit.png`         |
| perk      | Payout Booster              | `payout_booster.png`             |

> Eco-level tier icons (Seed → Tree of Life) already live in the `gamification-levels` bucket
> (`Level01Seed.png` … `Level20TreeOfLife.png`) and are referenced by `lib/gamification.ts`.
