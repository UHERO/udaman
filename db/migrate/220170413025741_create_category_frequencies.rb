class CreateCategoryFrequencies < ActiveRecord::Migration
  def change
      create_table :category_frequencies, id: false do |t|
      t.belongs_to :category, index: true
      t.string     :frequency, index: true
    end
    add_index :category_frequencies, [:category_id, :frequency], unique: true
  end
end
