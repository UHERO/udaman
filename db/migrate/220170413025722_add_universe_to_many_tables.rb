class AddUniverseToManyTables < ActiveRecord::Migration
  def change
    change_column :categories, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), default: 'UHERO', after: :id
    add_column :data_lists, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :data_points, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :data_sources, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :feature_toggles, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :geographies, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :measurements, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :public_data_points, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', first: true
    add_column :series, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :source_details, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :sources, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_column :users, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_index :categories, :universe
    add_index :data_lists, :universe
    add_index :data_points, :universe
    add_index :data_sources, :universe
    add_index :measurements, :universe
    add_index :public_data_points, :universe
    add_index :series, :universe
    add_index :source_details, :universe
    add_index :sources, :universe
    add_index :users, :universe
  end
end
