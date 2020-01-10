class CreateFeatureToggles < ActiveRecord::Migration
  def change
    create_table :feature_toggles do |t|
      t.string :name
      t.string :description
      t.boolean :status

      t.timestamps null: false
    end
  end
end
