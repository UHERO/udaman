class AddTypeToSources < ActiveRecord::Migration
  def change
    add_column :sources, :source_type, :string, after: :id
  end
end
