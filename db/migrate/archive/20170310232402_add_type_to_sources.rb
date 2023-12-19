class AddTypeToSources < ActiveRecord::Migration[5.2]
  def change
    add_column :sources, :source_type, :string, after: :id
  end
end
