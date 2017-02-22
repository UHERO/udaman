class AddSeriesPropertiesToMeasurements < ActiveRecord::Migration
  def change
    add_column :measurements, :source_link, :string, after: :real
    add_reference :measurements, :source, after: :real, foreign_key: true
    add_reference :measurements, :source_detail, after: :real, foreign_key: true
    add_column :measurements, :seasonally_adjusted, :boolean, after: :real
    add_column :measurements, :restricted, :boolean, after: :real
    add_column :measurements, :units, :integer, limit: 4, after: :data_portal_name
    add_column :measurements, :frequency_transform, :string, after: :data_portal_name
  end
end
