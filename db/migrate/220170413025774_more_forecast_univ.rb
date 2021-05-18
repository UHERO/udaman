class MoreForecastUniv < ActiveRecord::Migration[5.2]
  def self.up
    change_column :categories, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
  end

  def self.down
    change_column :categories, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
  end
end
