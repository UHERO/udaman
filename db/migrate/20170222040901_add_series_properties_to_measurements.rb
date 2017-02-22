class AddSeriesPropertiesToMeasurements < ActiveRecord::Migration
  def change
    add_column :measurements, :source_link, after: :real, :string
    add_reference :measurements, :source, after: :real, foreign_key: true
    add_reference :measurements, :source_detail, after: :real, foreign_key: true
    add_column :measurements, :seasonally_adjusted, after: :real, :boolean
    add_column :measurements, :restricted, after: :real, :boolean
    add_column :measurements, :units, :integer, after: :data_portal_name, limit: 4
    add_column :measurements, :frequency_transform, :string, after: :notes
  end
end
