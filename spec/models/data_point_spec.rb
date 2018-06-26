require 'spec_helper'

describe DataPoint do
  before(:each) do
    @s = Series.create name: 'FOOTEST@HI.Q'
    @ds1_80 = DataSource.create priority: 80
    @ds2_80 = DataSource.create priority: 80
    @ds2_70 = DataSource.create priority: 70
    ## Shove anything other than zero into currently unused :ytd column as a way
    ## to check dp object identity that doesn't depend on the clock
    @arbitrary_float = 75.42
    @dp = DataPoint.create(date: '2011-03-01',
                           value: 100.0,
                           series_id: @s.id,
                           data_source_id: @ds1_80.id,
                           ytd: @arbitrary_float,
                           current: true)
  end

  it 'should NOT change dp if value and source_id are unchanged' do
    sleep 1.2
    newdp = @dp.upd(100, @ds1_80)
    cur_dps = @s.current_data_points
    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(cur_dps.first.id.to_s).to eq(@dp.id.to_s), 'current dp has different id from original'
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'orig dp value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'orig dp source has changed in place'
  end

  it 'should update a dp data source if source is different, source.priority >= current' do
    newdp = @dp.upd(100, @ds2_80)
    cur_dps = @s.current_data_points
    #@dp = @dp.reload

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.id.to_s).not_to eq(@dp.id.to_s), 'current dp has same id as original'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(newdp.ytd).not_to eq(@arbitrary_float), 'new dp has same ytd marker as original'
    expect(@dp.current).to eq(false), 'old dp still set to current'
    expect(newdp.value_equal_to? @dp.value).to eq(true), 'dp values are not equal'
    expect(newdp.data_source_id).to eq(@ds2_80.id), 'new dp does not have new source'
  end

  it 'should NOT update a dp data source if source is different, source.priority < current' do
    newdp = @dp.upd(100, @ds2_70)
    cur_dps = @s.current_data_points

    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(cur_dps.first.id.to_s).to eq(@dp.id.to_s), 'current dp has different id from original'
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'orig dp value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'orig dp source has changed in place'
  end

  it 'should update a dp value if value is different, source.priority >= current' do
    newdp = @dp.upd(200, @ds2_80)
    @dp = @dp.reload
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(@dp.current).to eq(false), 'old dp still set to current'
    expect(newdp.value_equal_to? @dp.value).to eq(false), 'new and old dp values are equal'
    expect(newdp.data_source_id).to eq(@ds2_80.id), 'new dp doesnt have the new source'
  end

  it 'should NOT update a dp value if value is different, source.priority < current' do
    newdp = @dp.upd(200, @ds2_70)
    @dp = @dp.reload
    cur_dps = @s.current_data_points

    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'orig dp value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'orig dp source has changed in place'
  end

  #########################################################################################################

  ## what about if there is an old dp with the correct properties, but lower priority? should not be restored
  it 'should restore previously current dp, when updated to its same properties' do
    dp1 = @dp.upd(200, @ds2_80)
    ## dp1 should now be current, as tested above
    newdp = dp1.upd(@dp.value, @dp.data_source)
    ## now @dp should be restored to current, and newdp should === @dp

    expect(@s.current_data_points.count).to eq(1), 'not exactly one current dp'
    expect(@s.data_points.count).to eq(2), 'not exactly two dps for this series'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.ytd).to eq(@arbitrary_float), 'a new dp was created rather than an old one restored'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(dp1.current).to eq(false), 'previous current dp still set to current'
    expect(newdp.value_equal_to? @dp.value).to eq(true), 'orig dp value has changed in place'
    expect(newdp.data_source_id).to eq(@dp.data_source_id), 'orig dp source has changed in place'
  end

  xit 'should restore correct dp next-in-line by updated_at time when current is deleted, part I' do
    sleep 1.2
    dp200 = @dp.upd(200, @ds1_80)
    sleep 1.2
    dp500 = dp200.upd(500, @ds1_80)
    cdp = @s.current_data_points
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? dp500.value).to eq(true), 'current dp is not dp=500'
    expect(dp500.current).to eq(true), 'new dp not set to current'
    expect(@s.data_points.count).to eq(3), 'not exactly three dps in this series'

    dp500.delete
    cdp = @s.current_data_points

    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? dp200.value).to eq(true), 'current dp is not dp=200'
    expect(dp200.current).to eq(true), 'dp=200 not set to current'
    expect(@s.data_points.count).to eq(2), 'not exactly two dps for this series'
  end

  xit 'should restore correct dp next-in-line by updated_at time when current is deleted, part II' do
    sleep 1.2
    dp200 = @dp.upd(200, @ds1_80)
    dp200.ytd = 22.22
    sleep 1.2
    dp500 = dp200.upd(500, @ds1_80)

    ## restore 200
    restoredp = dp500.upd(dp200.value, dp200.data_source)
    cdp = @s.current_data_points
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(dp200.current).to eq(true), 'restored dp=200 is not current'
    expect(restoredp.ytd).to eq(22.22), 'restored dp ytd not identical to dp=200.ytd'
    expect(restoredp.value_equal_to? dp200.value).to eq(true), 'restored dp value != dp=200'
    expect(@s.data_points.count).to eq(3), 'not exactly three dps for this series'

    ## restore 100
    restoredp = restoredp.upd(@dp.value, @dp.data_source)
    cdp = @s.current_data_points
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(@dp.current).to eq(true), 'restored dp=100 is not current'
    expect(restoredp.ytd).to eq(@arbitrary_float), 'restored dp not identical to original @dp=100'
    expect(restoredp.value_equal_to? @dp.value).to eq(true), 'restored dp value != orig @dp=100'
    expect(@s.data_points.count).to eq(3), 'not exactly three dps for this series'

    ## then delete current
    restoredp.delete
    cdp = @s.current_data_points
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.ytd).to eq(22.22), 'current dp is not dp=200'
    expect(dp200.current).to eq(true), 'dp=200 not set to current'
    expect(dp500.current).to eq(false), 'dp=500 set wrongly to current'
    expect(@s.data_points.count).to eq(2), 'not exactly two dps for this series'
  end

  xit 'should NOT change current dp when non-current dp is deleted' do
    ##### this is not right... latest updated needs to be not the same as current
    sleep 1.2
    dp = @dp.upd(200, @ds1_80)
    sleep 1.2
    dp400 = dp.upd(400, @ds1_80)
    sleep 1.2
    dp = dp400.upd(300, @ds1_80)
    sleep 1.2
    dp = dp.upd(500, @ds1_80)
    cdp = @s.current_data_points
    expect(dp.current).to eq(true), 'new dp not set to current'
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? 500).to eq(true), 'correct dp=500 not restored to current'
    expect(@s.data_points.count).to eq(5), 'not exactly five dps in this series'

    dp400.delete
    cdp = @s.current_data_points

    expect(dp.current).to eq(true), 'original current dp no longer set to current'
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? 500).to eq(true), 'dp=500 does not remain as current'
    expect(@s.data_points.count).to eq(4), 'not exactly four dps for this series'
  end
end
